import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ts: { type: Date, required: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true, index: true }
);

activitySchema.index({ userId: 1, ts: 1 });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;


