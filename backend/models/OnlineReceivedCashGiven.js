import mongoose from 'mongoose';

const onlineReceivedCashGivenSchema = new mongoose.Schema(
  {
    // Basic transaction details
    receivedOnlineAmount: {
      type: Number,
      required: true,
      min: 0
    },
    cashGiven: {
      type: Number,
      required: true,
      min: 0
    },
    receivedOnlineFrom: {
      type: String,
      required: true,
      enum: ['Vaibhav', 'Omkar', 'Uma', 'Vaishnavi', 'Shop'],
      trim: true
    },
    
    // Sender information
    senderName: {
      type: String,
      trim: true,
      default: ''
    },
    senderNumber: {
      type: String,
      trim: true,
      default: ''
    },
    
    // Application and account details
    receivedOnApplication: {
      type: String,
      enum: ['Shop QR', 'PhonePe', 'Paytm', 'Google Pay'],
      trim: true,
      default: 'Shop QR'
    },
    accountHolder: {
      type: String,
      enum: ['Vaibhav', 'Omkar', 'Uma', 'Vaishnavi', 'Shop'],
      trim: true
    },
    accountHolderRemark: {
      type: String,
      trim: true,
      default: ''
    },
    
    // Commission details
    commissionType: {
      type: String,
      enum: ['No Commission', 'Cash Commission', 'Online Commission'],
      trim: true,
      default: 'No Commission'
    },
    commissionAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    commissionRemark: {
      type: String,
      trim: true,
      default: ''
    },
    
    // Money distribution logic
    moneyDistributionType: {
      type: String,
      required: true,
      enum: ['Full Amount given by One Person', 'Full Amount given by Two Persons'],
      trim: true
    },
    
    // Single person scenario fields
    howMoneyGivenSingle: {
      type: String,
      enum: ['Cash from Gala', 'Vaibhav', 'Omkar', 'Uma', 'Vaishnavi', 'Cash Given to Customer by Person'],
      trim: true
    },
    howMoneyGivenSinglePersonName: {
      type: String,
      enum: ['Vaibhav', 'Omkar', 'Uma', 'Vaishnavi'],
      trim: true
    },
    
    // Two persons scenario fields
    firstPartMoneyGiven: {
      type: String,
      enum: ['Cash from Gala', 'Vaibhav', 'Omkar', 'Uma', 'Vaishnavi', 'Cash Given to Customer by Person'],
      trim: true
    },
    firstPartMoneyGivenPersonName: {
      type: String,
      enum: ['Vaibhav', 'Omkar', 'Uma', 'Vaishnavi'],
      trim: true
    },
    firstPartAmount: {
      type: Number,
      min: 0
    },
    
    remainingPartMoneyGiven: {
      type: String,
      enum: ['Cash from Gala', 'Vaibhav', 'Omkar', 'Uma', 'Vaishnavi', 'Cash Given to Customer by Person'],
      trim: true
    },
    remainingPartMoneyGivenPersonName: {
      type: String,
      enum: ['Vaibhav', 'Omkar', 'Uma', 'Vaishnavi'],
      trim: true
    },
    remainingPartAmount: {
      type: Number,
      min: 0
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

const OnlineReceivedCashGiven = mongoose.model('OnlineReceivedCashGiven', onlineReceivedCashGivenSchema);
export default OnlineReceivedCashGiven;