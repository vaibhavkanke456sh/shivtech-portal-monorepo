import mongoose from 'mongoose';

const aepsEntrySchema = new mongoose.Schema(
  {
    aepsIdType: { type: String, required: true, trim: true },
    aepsIdName: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    givenToCustomer: { type: String, required: true, trim: true },
    givenToCustomerRemark: { type: String, default: '' },
    givenToCustomerOther: { type: String, default: '' },
    withdrawnType: { type: String, default: '' },
    commissionType: { type: String, required: true, trim: true },
    commissionAmount: { type: Number, default: 0, min: 0 },
    commissionRemark: { type: String, default: '' },
    paymentApplication: { type: String, default: '' },
    transferredFrom: { type: String, default: '' },
    transferredFromRemark: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const AepsEntry = mongoose.model('AepsEntry', aepsEntrySchema);
export default AepsEntry;



