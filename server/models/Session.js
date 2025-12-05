import mongoose from "mongoose";

const stemAnalysisSchema = new mongoose.Schema(
  {
    name: String,
    role_guess: String,
    type: String,
    duration_s: Number,
    sample_rate: Number,
    channels: Number,
    metrics: {
      rms_db: Number,
      peak_db: Number,
      crest: Number,
      band_pct: {
        sub_20_60: Number,
        low_60_200: Number,
        lowmid_200_500: Number,
        mid_500_2k: Number,
        highmid_2k_5k: Number,
        presence_5k_10k: Number,
        air_10k_18k: Number,
      },
    },
  },
  { _id: false }
);

const conversationEntrySchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "coach"],
      required: true,
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "Untitled Session",
    },
    daw: {
      type: String,
      required: true,
    },
    stems: [stemAnalysisSchema],
    songSummary: {
      avg_band_pct: {
        sub_20_60: Number,
        low_60_200: Number,
        lowmid_200_500: Number,
        mid_500_2k: Number,
        highmid_2k_5k: Number,
        presence_5k_10k: Number,
        air_10k_18k: Number,
      },
      stem_count: Number,
      vocal_stem_count: Number,
      loudest_stem: String,
      quietest_stem: String,
    },
    conversation: [conversationEntrySchema],
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "completed",
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
sessionSchema.index({ user: 1, createdAt: -1 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;
