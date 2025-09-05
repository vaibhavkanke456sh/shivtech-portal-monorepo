import User from '../models/User.js';
import OtpToken from '../models/OtpToken.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send email with fallback to Ethereal in development
const sendEmailWithFallback = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl?.(info) || null;
    return { info, previewUrl };
  } catch (primaryError) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const etherealTransport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await etherealTransport.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      return { info, previewUrl };
    } catch (fallbackError) {
      // Return failure without throwing to allow dev flows to continue
      return { info: null, previewUrl: null };
    }
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, role = 'user' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      role
    });

    // Set default permissions based on role
    const defaultPermissions = {
      user: ['read_dashboard'],
      admin: ['read_dashboard', 'write_dashboard', 'manage_users', 'view_analytics', 'manage_content'],
      web_developer: ['read_dashboard', 'write_dashboard', 'manage_users', 'manage_admins', 'manage_developers', 'view_analytics', 'manage_content', 'system_settings']
    };

    user.permissions = defaultPermissions[role] || defaultPermissions.user;

    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Send verification email
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    const verificationUrl = `${process.env.CORS_ORIGIN}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Verify your DSAM Portal account',
      html: `
        <h2>Welcome to DSAM Portal!</h2>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue with registration even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, identifier, password, expectedRole } = req.body;

    // Support login by email or username via identifier
    let user;
    if (identifier && !email) {
      const found = await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ],
        isActive: true
      });
      if (!found) throw new Error('Invalid login credentials');
      const isMatch = await found.comparePassword(password);
      if (!isMatch) {
        await found.incLoginAttempts();
        throw new Error('Invalid login credentials');
      }
      await found.resetLoginAttempts();
      user = found;
    } else {
      user = await User.findByCredentials(email, password);
    }

    // Enforce role-based login page: reject if role does not match the page used
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: 'Please use the correct login page for your role.'
      });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          permissions: user.permissions
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
};

// Helper to create and email a 6-digit OTP
const sendOtp = async ({ email, purpose }) => {
  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  const otpHash = await bcrypt.hash(otp, salt);

  // Valid for 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Invalidate existing tokens of same purpose for this email
  await OtpToken.updateMany({ email, purpose, used: false }, { $set: { used: true } });

  await OtpToken.create({ email, purpose, otpHash, expiresAt });

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Your DSAM Portal OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px">
        <h2>Your OTP Code</h2>
        <p>Use this 6-digit code to complete your ${purpose.replace('_', ' ')} request:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:8px">${otp}</div>
        <p>This code expires in 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `
  };

  const { previewUrl } = await sendEmailWithFallback(mailOptions);

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    console.log(`[DEV] OTP for ${email} (${purpose}): ${otp} (expires ${expiresAt.toISOString()})`);
    return { expiresAt, devOtp: otp, previewUrl };
  }

  return { expiresAt, previewUrl };
};

// @desc    Request OTP (for password/username changes)
// @route   POST /api/auth/request-otp
// @access  Private
export const requestOtp = async (req, res) => {
  try {
    const { purpose } = req.body; // 'change_password' | 'change_username'
    const email = req.user.email;

    if (!['change_password', 'change_username'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid purpose' });
    }

    // Only web_developer can request username change OTP
    if (purpose === 'change_username' && req.user.role !== 'web_developer') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const { expiresAt, devOtp, previewUrl } = await sendOtp({ email, purpose });
    const payload = { expiresAt };
    if (devOtp) payload.devOtp = devOtp;
    if (previewUrl) payload.previewUrl = previewUrl;
    res.json({ success: true, message: 'OTP sent to email', data: payload });
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Private
export const verifyOtp = async (req, res) => {
  try {
    const { otp, purpose } = req.body;
    const email = req.user.email;

    const tokenDoc = await OtpToken.findOne({ email, purpose, used: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 });

    if (!tokenDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const isValid = await tokenDoc.compareOtp(otp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await OtpToken.deleteOne({ _id: tokenDoc._id });

    res.json({ success: true, message: 'OTP verified' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    // In a more advanced implementation, you might want to blacklist the token
    // For now, we'll just return a success response
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          permissions: user.permissions,
          profilePicture: user.profilePicture,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { username, firstName, lastName, profilePicture, otp } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // Username changes only for web developer via OTP
    if (username && username !== user.username) {
      if (req.user.role !== 'web_developer') {
        return res.status(403).json({ success: false, message: 'Only web developers can change username' });
      }
      const tokenDoc = await OtpToken.findOne({ email: user.email, purpose: 'change_username', used: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
      if (!tokenDoc) {
        return res.status(400).json({ success: false, message: 'OTP required or expired' });
      }
      const otpValid = await tokenDoc.compareOtp(otp || '');
      if (!otpValid) {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }
      const existing = await User.findOne({ username });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
      user.username = username;
      await OtpToken.deleteMany({ _id: tokenDoc._id });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (profilePicture) user.profilePicture = profilePicture;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          permissions: user.permissions,
          profilePicture: user.profilePicture
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // Require OTP for password change (all roles)
    const tokenDoc = await OtpToken.findOne({ email: user.email, purpose: 'change_password', used: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 });
    if (!tokenDoc) {
      return res.status(400).json({ success: false, message: 'OTP required or expired' });
    }

    const otpValid = await tokenDoc.compareOtp(otp || '');
    if (!otpValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();

    await OtpToken.deleteOne({ _id: tokenDoc._id });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Reset your DSAM Portal password',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    try {
      const { previewUrl } = await sendEmailWithFallback(mailOptions);
      if (previewUrl) {
        res.json({ success: true, message: 'Password reset email sent (preview available)', data: { previewUrl, resetUrl } });
      } else {
        res.json({ success: true, message: 'Password reset email sent' });
      }
      return;
    } catch (mailErr) {
      console.error('Forgot password email send failed:', mailErr);
      if ((process.env.NODE_ENV || 'development') !== 'production') {
        console.log(`[DEV] Password reset URL for ${user.email}: ${resetUrl}`);
        res.json({ success: true, message: 'Password reset email (dev fallback)', data: { resetUrl } });
        return;
      }
      throw mailErr;
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reset email'
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email'
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
export const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }
    
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    const verificationUrl = `${process.env.CORS_ORIGIN}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Verify your DSAM Portal account',
      html: `
        <h2>Email Verification</h2>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email'
    });
  }
};
