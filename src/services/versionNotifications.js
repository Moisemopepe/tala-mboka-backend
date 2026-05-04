import { getReleaseNotes } from "../config/releaseNotes.js";
import Notification from "../models/Notification.js";
import { notifyRoles } from "./notifications.js";

export async function sendAutomaticVersionNotifications(version) {
  const cleanVersion = String(version || "").trim();
  if (!cleanVersion) return;

  const adminTitle = `Nouvelle version ${cleanVersion}`;
  const userTitle = `Tala Mboka ${cleanVersion}`;
  const alreadySent = await Notification.exists({
    type: "version_release",
    title: { $in: [adminTitle, userTitle] }
  });

  if (alreadySent) {
    console.log(`Version ${cleanVersion} already notified`);
    return;
  }

  const notes = getReleaseNotes(cleanVersion);

  await Promise.all([
    notifyRoles({
      roles: ["admin", "moderator"],
      type: "version_release",
      title: adminTitle,
      message: notes.adminNotes
    }),
    notifyRoles({
      roles: ["user"],
      type: "version_release",
      title: userTitle,
      message: notes.userNotes
    })
  ]);

  console.log(`Version ${cleanVersion} notifications sent automatically`);
}
