import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["faculty", "security", "admin", "pending"],
      default: "pending", // Default for new users who need to complete registration
    },
    department: {
      type: String,
      enum: [
        "Automobile",
        "Chemistry",
        "Physics",
        "Maths",
        "English",
        "Humanity and sciences(H&S)",
        "Civil",
        "CSE",
        "CSE-AIML&IOT",
        "CSE-(CyS,DS)_and_AI&DS",
        "EEE",
        "ADMIN",
        "Research",
        "Accounts",
        "Academic",
        "Admission",
        "IQAC",
        "BioTech",
        "Library",
        "AE",
        "CAMS",
        "SSC",
        "Placement",
        "HR",
        "ECE",
        "EIE",
        "MECH",
        "VJ_Hub",
        "GRO",
        "RCC",
        "IT",
        "Other"
      ],
      required: function() {
        // Department is required only for faculty
        return this.role === "faculty";
      },
    },
    facultyId: {
      type: String,
      required: function() {
        // Faculty ID is required only for faculty
        return this.role === "faculty";
      },
      unique: true,
      sparse: true, // Allows multiple null values for non-faculty users
    },
    // OAuth fields (required since we only use Google OAuth)
    googleId: {
      type: String,
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ["google"],
      default: "google",
      required: true,
    },
    avatar: {
      type: String, // URL to profile picture from Google
      default: null,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: true, // All Google OAuth users are automatically verified
    },
    keyUsage: {
      type: Map,
      of: Number, // keyId -> usage count
      default: {},
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;