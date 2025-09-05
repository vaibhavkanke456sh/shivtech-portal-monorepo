import express from 'express';
import mongoose from 'mongoose';

const app = express();

// NOTE: For quick testing only. Prefer using environment variables in production.
const MONGO_URI =
  'mongodb+srv://shivanshmultiservices4508:9ZDxTIRPLR4uBW5k@shivtech456.nngsujr.mongodb.net/test?retryWrites=true&w=majority&appName=SHIVTECH456';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

await connectDB();

const TestSchema = new mongoose.Schema({
  name: String,
  createdAt: { type: Date, default: Date.now },
});
const Test = mongoose.model('Test', TestSchema);

app.get('/test', async (req, res) => {
  try {
    const doc = await Test.create({ name: 'Hello MongoDB' });
    res.json({ message: '✅ Test document inserted!', doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 Server is running & MongoDB is connected!');
});

const PORT = process.env.PORT || 5050; // Use 5050 to avoid conflicts with main server
app.listen(PORT, () => console.log(`🚀 Demo server running on port ${PORT}`));


