const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://admin:password@127.0.0.1:27017/myapp?authSource=admin";

// Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// User schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// GET: Retrieve users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const total = await User.countDocuments();

    res.json({ users, total });
  } catch (error) {
    console.error("Get users error:", error.message);
    res.status(500).json({ error: "Unable to load users." });
  }
});

// POST: Create a user
app.post("/api/users", async (req, res) => {
  try {
    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!name || name.length > 100) {
      return res.status(400).json({
        error: "Name must contain 1–100 characters.",
      });
    }

    if (
      email &&
      (email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    const user = await User.create({ name, email });

    res.status(201).json({
      message: "User created successfully.",
      user,
    });
  } catch (error) {
    console.error("Create user error:", error.message);
    res.status(500).json({ error: "Unable to save user." });
  }
});

// DELETE: Remove a user
app.delete("/api/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid user ID.",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    res.json({
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("Delete user error:", error.message);
    res.status(500).json({
      error: "Unable to delete user.",
    });
  }
});

// Start the server only when this file is run directly
async function start() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected successfully");

  app.listen(PORT, () => {
    console.log(`App running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Startup failed:", error.message);
    process.exit(1);
  });
}

module.exports = app;
