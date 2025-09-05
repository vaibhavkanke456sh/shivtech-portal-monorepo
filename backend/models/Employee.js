import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    email: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['user', 'admin', 'web_developer'], default: 'user' },
    department: { type: String, default: '' }
  },
  { timestamps: true }
);

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;


