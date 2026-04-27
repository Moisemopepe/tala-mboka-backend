import express from "express";
import { requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      $or: [{ userId: req.user._id }, { roles: req.user.role }]
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const items = notifications.map((notification) => ({
      ...notification,
      read: notification.readBy?.some((userId) => userId.toString() === req.user._id.toString()) || false
    }));

    res.json({
      notifications: items,
      unread: items.filter((notification) => !notification.read).length
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/read", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { $or: [{ userId: req.user._id }, { roles: req.user.role }], readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
