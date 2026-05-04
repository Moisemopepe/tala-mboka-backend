import express from "express";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      $or: [{ userId: req.user._id }, { roles: req.user.role }]
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("reportId", "title status province commune");

    const items = notifications.map((notification) => ({
      ...notification.toJSON(),
      read: notification.readBy.some((id) => id.toString() === req.user._id.toString())
    }));

    res.json({
      unread: items.filter((item) => !item.read).length,
      notifications: items
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/read", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { $or: [{ userId: req.user._id }, { roles: req.user.role }], readBy: { $ne: req.user._id } },
      { $push: { readBy: req.user._id } }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    next(error);
  }
});

export default router;
