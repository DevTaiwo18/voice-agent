import express from "express";
import Session from "../models/Session.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// @route   POST /api/sessions
// @desc    Create a new session
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Check session limit for free users
    if (user.plan === "free" && user.sessionsUsed >= user.sessionsLimit) {
      return res.status(403).json({
        message: "Session limit reached. Upgrade to Pro for unlimited sessions.",
      });
    }

    const { title, daw, stems, songSummary, notes } = req.body;

    const session = await Session.create({
      user: req.user._id,
      title: title || `Session ${user.sessionsUsed + 1}`,
      daw,
      stems,
      songSummary,
      notes,
      status: "active",
    });

    // Increment sessions used
    user.sessionsUsed += 1;
    await user.save();

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sessions
// @desc    Get all sessions for user
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-conversation"); // Exclude conversation for list view

    const total = await Session.countDocuments({ user: req.user._id });

    res.json({
      sessions,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sessions/:id
// @desc    Get single session by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/sessions/:id
// @desc    Update session (add conversation, update status, etc.)
// @access  Private
router.put("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const { title, status, duration, notes } = req.body;

    if (title) session.title = title;
    if (status) session.status = status;
    if (duration) session.duration = duration;
    if (notes) session.notes = notes;

    const updatedSession = await session.save();
    res.json(updatedSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/sessions/:id/conversation
// @desc    Add message to session conversation
// @access  Private
router.post("/:id/conversation", protect, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const { role, message } = req.body;

    session.conversation.push({
      role,
      message,
      timestamp: new Date(),
    });

    const updatedSession = await session.save();
    res.json(updatedSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/sessions/:id
// @desc    Delete session
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    await session.deleteOne();
    res.json({ message: "Session deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sessions/stats/overview
// @desc    Get user session statistics
// @access  Private
router.get("/stats/overview", protect, async (req, res) => {
  try {
    const totalSessions = await Session.countDocuments({ user: req.user._id });
    const completedSessions = await Session.countDocuments({
      user: req.user._id,
      status: "completed",
    });

    const totalDuration = await Session.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    const recentSessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title daw createdAt status");

    res.json({
      totalSessions,
      completedSessions,
      totalDuration: totalDuration[0]?.total || 0,
      recentSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
