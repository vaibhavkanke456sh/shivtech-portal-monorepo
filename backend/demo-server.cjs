const express = require("express");
const mongoose = require("mongoose");

const app = express();

// ✅ Replace <password> with your real Atlas password
const MONGO_URI =
  "mongodb+srv://shivanshmultiservices4508:9ZDxTIRPLR4uBW5k@shivtech456.nngsujr.mongodb.net/test?retryWrites=true&w=majority&appName=SHIVTECH456";

// Connect to MongoDB Atlas
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully!");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}
connectDB();

// Test schema
const TestSchema = new mongoose.Schema({
  name: String,
  createdAt: { type: Date, default: Date.now },
});
const Test = mongoose.model("Test", TestSchema);

// Route to insert a test document
app.get("/test", async (req, res) => {
  try {
    const doc = await Test.create({ name: "Hello MongoDB" });
    res.json({ message: "✅ Test document inserted!", doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("🚀 Server is running & MongoDB is connected!");
});

// Start server (5051 to avoid clashing with main server)
const PORT = process.env.PORT || 5051;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


