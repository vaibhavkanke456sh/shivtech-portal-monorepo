import mongoose from 'mongoose';

const serviceGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const ServiceGroup = mongoose.model('ServiceGroup', serviceGroupSchema);
export default ServiceGroup;
