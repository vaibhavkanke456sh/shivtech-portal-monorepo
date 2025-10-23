import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    serialNo: { type: String, default: '' },
    date: { type: String, required: true },
    taskName: { type: String, required: true, trim: true },
    customerName: { type: String, required: true },
    customerType: { type: String, enum: ['new', 'old'], required: true },
    serviceDeliveryDate: { type: String, default: '' },
    taskType: { type: String, enum: ['do-now', 'urgent', 'normal'], required: true },
    assignedTo: { type: String, default: '' },
    serviceCharge: { type: Number, default: 0 },
    finalCharges: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'shop-qr', 'personal-qr', 'other'], default: 'cash' },
    paymentRemarks: { type: String, default: '' },
    amountCollected: { type: Number, default: 0 },
    unpaidAmount: { type: Number, default: 0 },
    paymentHistory: {
      type: [
        {
          amount: Number,
          paymentMode: { type: String, enum: ['cash', 'shop-qr', 'personal-qr', 'other'], default: 'cash' },
          paymentRemarks: String,
          paidAt: { type: Date, default: Date.now },
          isInitialPayment: { type: Boolean, default: false }
        }
      ],
      default: []
    },
    documentDetails: { type: String, default: '' },
    uploadedDocuments: {
      type: [
        {
          id: String,
          name: String,
          url: String,
          uploadedAt: String,
        },
      ],
      default: [],
    },
    remarks: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'ongoing', 'completed', 'assigned', 'unassigned'], default: 'pending' },
    completedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true }
);

const Task = mongoose.model('Task', taskSchema);
export default Task;


