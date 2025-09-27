import mongoose from 'mongoose';

const mobileBalanceSchema = new mongoose.Schema(
  {
    companyName: { 
      type: String, 
      required: true, 
      enum: ['AIRTEL', 'JIO', 'BSNL', 'VODAFONE'],
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

const MobileBalance = mongoose.model('MobileBalance', mobileBalanceSchema);
export default MobileBalance;