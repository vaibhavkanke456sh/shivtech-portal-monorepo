import mongoose from 'mongoose';

const salesEntrySchema = new mongoose.Schema(
  {
    entryType: {
      type: String,
      required: true,
      enum: [
        'RECHARGE_ENTRY',
        'BILL_PAYMENT_ENTRY', 
        'SIM_SOLD',
        'XEROX',
        'PRINT',
        'PASSPORT_PHOTOS',
        'LAMINATIONS'
      ],
      trim: true
    },
    // Common fields for all entry types
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    customerName: {
      type: String,
      trim: true
    },
    customerNumber: {
      type: String,
      trim: true
    },
    // Recharge specific fields
    rechargeNumber: {
      type: String,
      trim: true
    },
    rechargeOperator: {
      type: String,
      enum: ['AIRTEL', 'JIO', 'BSNL', 'VODAFONE', 'Other'],
      trim: true
    },
    rechargeType: {
      type: String,
      enum: ['Prepaid', 'Postpaid', 'DTH'],
      trim: true
    },
    // Bill payment specific fields
    billType: {
      type: String,
      enum: ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile', 'Other'],
      trim: true
    },
    billNumber: {
      type: String,
      trim: true
    },
    // SIM sold specific fields
    simOperator: {
      type: String,
      enum: ['AIRTEL', 'JIO', 'BSNL', 'VODAFONE'],
      trim: true
    },
    simType: {
      type: String,
      enum: ['Prepaid', 'Postpaid'],
      trim: true
    },
    // Print/Xerox/Passport/Lamination specific fields
    quantity: {
      type: Number,
      min: 1
    },
    paperSize: {
      type: String,
      enum: ['A4', 'A3', 'Legal', 'Letter', 'Other'],
      trim: true
    },
    colorType: {
      type: String,
      enum: ['Black & White', 'Color'],
      trim: true
    },
    // Commission and payment details
    commissionType: {
      type: String,
      enum: ['Online', 'Cash'],
      trim: true
    },
    commissionAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Online', 'UPI', 'Card'],
      trim: true
    },
    // General fields
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const SalesEntry = mongoose.model('SalesEntry', salesEntrySchema);
export default SalesEntry;