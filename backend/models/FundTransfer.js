import mongoose from 'mongoose';

const fundTransferSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerNumber: { type: String, required: true, trim: true },
    beneficiaryName: { type: String, required: true, trim: true },
    beneficiaryNumber: { type: String, required: true, trim: true },
    applicationName: { type: String, required: true, enum: ['PhonePe', 'Paytm', 'Google Pay', 'Other'] },
    transferredFrom: { type: String, required: true, enum: ['Vaibhav', 'Omkar', 'Uma', 'Shop Accounts', 'Other'] },
    transferredFromRemark: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    cashReceived: { type: String, required: true, enum: ['Yes', 'No'] },
    addedInGala: { type: String, required: true, enum: ['Yes', 'No'] },
    addedInGalaRemark: { type: String, default: '' },
    commissionType: { type: String, required: true, enum: ['Online', 'Cash'] },
    commissionAmount: { type: Number, default: 0, min: 0 },
    commissionRemark: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const FundTransfer = mongoose.model('FundTransfer', fundTransferSchema);
export default FundTransfer;



