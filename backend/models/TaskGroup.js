import mongoose from 'mongoose';

const taskGroupSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    customerType: { type: String, enum: ['new', 'old'], required: true },
    documentDetails: { type: String, default: '' },
    totalAmount: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'shop-qr', 'personal-qr', 'other', 'discount'], default: 'cash' },
    paymentNotes: { type: String, default: '' },
    discountAmount: { type: Number, default: 0 },
    paymentHistory: {
      type: [
        {
          amount: Number,
          paymentMode: { type: String, enum: ['cash', 'shop-qr', 'personal-qr', 'other', 'discount'], default: 'cash' },
          paymentRemarks: String,
          paidAt: { type: Date, default: Date.now },
          isInitialPayment: { type: Boolean, default: false }
        }
      ],
      default: []
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true }
);

const TaskGroup = mongoose.model('TaskGroup', taskGroupSchema);
export default TaskGroup;
