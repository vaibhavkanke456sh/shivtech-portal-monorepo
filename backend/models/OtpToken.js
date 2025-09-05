import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const otpTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  purpose: {
    type: String,
    enum: ['change_password', 'change_username'],
    required: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// TTL index to auto-remove expired tokens
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpTokenSchema.methods.compareOtp = async function(plainOtp) {
  return bcrypt.compare(plainOtp, this.otpHash);
};

const OtpToken = mongoose.model('OtpToken', otpTokenSchema);

export default OtpToken;


