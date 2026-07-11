import mongoose from 'mongoose';

const paymentHistorySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    paymentMode: {
      type: String,
      enum: ['cash', 'shop-qr', 'personal-qr', 'other'],
      default: 'cash'
    },
    remarks: { type: String, trim: true, default: '' },
    collectedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const paymentCollectSchema = new mongoose.Schema(
  {
    personName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    totalAmount: { type: Number, required: true, min: 0 },
    amountReceived: { type: Number, default: 0, min: 0 },
    pendingAmount: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true, default: '' },
    paymentHistory: { type: [paymentHistorySchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'partial', 'received'],
      default: 'pending'
    },
    date: { type: Date, default: Date.now },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Keep pendingAmount and status in sync before save
paymentCollectSchema.pre('save', function (next) {
  const total = Number(this.totalAmount) || 0;
  const received = Number(this.amountReceived) || 0;
  this.pendingAmount = Math.max(total - received, 0);

  if (received <= 0) {
    this.status = 'pending';
  } else if (received >= total) {
    this.status = 'received';
    this.pendingAmount = 0;
  } else {
    this.status = 'partial';
  }
  next();
});

const PaymentCollect = mongoose.model('PaymentCollect', paymentCollectSchema);
export default PaymentCollect;
