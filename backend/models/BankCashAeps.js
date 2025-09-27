import mongoose from 'mongoose';

const bankCashAepsSchema = new mongoose.Schema(
  {
    companyName: { 
      type: String, 
      required: true, 
      enum: [
        'Bank', 
        'Cash', 
        'Redmil', 
        'SpiceMoney', 
        'Airtel Payment Bank', 
        'Collect From Vaibhav', 
        'Collect From Omkar', 
        'Collect From Uma', 
        'Shop QR'
      ],
      trim: true 
    },
    operationType: { 
      type: String, 
      required: true, 
      enum: ['add', 'remove'],
      trim: true 
    },
    amount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    reason: { 
      type: String, 
      required: true, 
      trim: true 
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

const BankCashAeps = mongoose.model('BankCashAeps', bankCashAepsSchema);
export default BankCashAeps;