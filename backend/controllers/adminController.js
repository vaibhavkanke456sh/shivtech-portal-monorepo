import User from '../models/User.js';
import OtpToken from '../models/OtpToken.js';
import { validationResult } from 'express-validator';

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private (Admin/Web Developer)
export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;
    const search = req.query.search;
    
    const skip = (page - 1) * limit;
    
    let query = { isActive: true };
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/admin/users/:id
// @access  Private (Admin/Web Developer)
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationToken -passwordResetToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

// @desc    Create new user (Admin only)
// @route   POST /api/admin/users
// @access  Private (Admin/Web Developer)
export const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const { username, email, password, firstName, lastName, role, permissions } = req.body;
    
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
      role,
      permissions,
      createdBy: req.user?._id || null,
      isEmailVerified: true // Admin created users are pre-verified
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

// @desc    Create an admin (Web Developer only)
// @route   POST /api/admin/create-admin
// @access  Private (Web Developer)
export const createAdminAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    if (req.user.role !== 'web_developer') {
      return res.status(403).json({ success: false, message: 'Only web developers can create admins' });
    }

    const { username, email, password, firstName, lastName } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: existingUser.email === email ? 'Email already registered' : 'Username already taken' });
    }

    const adminPermissions = ['read_dashboard','write_dashboard','manage_users','view_analytics','manage_content'];

    const user = new User({ username, email, password, firstName, lastName, role: 'admin', permissions: adminPermissions, isEmailVerified: true, createdBy: req.user._id });
    await user.save();

    return res.status(201).json({ success: true, message: 'Admin created successfully', data: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

// @desc    Create a regular user (Web Developer/Admin)
// @route   POST /api/admin/create-user
// @access  Private
export const createUserAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Admin can create only one user
    if (req.user.role === 'admin') {
      const alreadyCreated = await User.countDocuments({ createdBy: req.user._id, role: 'user' });
      if (alreadyCreated >= 1) {
        return res.status(403).json({ success: false, message: 'Admin can create only one user' });
      }
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: existingUser.email === email ? 'Email already registered' : 'Username already taken' });
    }

    const user = new User({ username, email, password, firstName, lastName, role: 'user', permissions: ['read_dashboard'], isEmailVerified: true, createdBy: req.user._id });
    await user.save();

    return res.status(201).json({ success: true, message: 'User created successfully', data: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('Create user (role user) error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

// @desc    Change a user's username (Web Developer via OTP)
// @route   PATCH /api/admin/change-username
// @access  Private (Web Developer)
export const changeUsername = async (req, res) => {
  try {
    const { userId, newUsername, otp } = req.body;

    if (req.user.role !== 'web_developer') {
      return res.status(403).json({ success: false, message: 'Only web developers can change usernames' });
    }

    const tokenDoc = await OtpToken.findOne({ email: req.user.email, purpose: 'change_username', used: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    if (!tokenDoc) return res.status(400).json({ success: false, message: 'OTP required or expired' });
    const otpValid = await tokenDoc.compareOtp(otp || '');
    if (!otpValid) return res.status(400).json({ success: false, message: 'Invalid OTP' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const existing = await User.findOne({ username: newUsername });
    if (existing) return res.status(400).json({ success: false, message: 'Username already taken' });

    user.username = newUsername;
    await user.save();

    await OtpToken.deleteMany({ _id: tokenDoc._id });

    return res.json({ success: true, message: 'Username changed successfully' });
  } catch (error) {
    console.error('Change username error:', error);
    return res.status(500).json({ success: false, message: 'Failed to change username' });
  }
};

// @desc    Delete account (Web Developer only)
// @route   DELETE /api/admin/delete-account/:id
// @access  Private (Web Developer)
export const deleteAccount = async (req, res) => {
  try {
    if (req.user.role !== 'web_developer') {
      return res.status(403).json({ success: false, message: 'Only web developers can delete accounts' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    user.isActive = false;
    await user.save();

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
};

// @desc    Update user (Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private (Admin/Web Developer)
export const updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const { username, firstName, lastName, role, permissions, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from modifying web developer accounts unless they are web developer
    if (user.role === 'web_developer' && req.user.role !== 'web_developer') {
      return res.status(403).json({
        success: false,
        message: 'Only web developers can modify web developer accounts'
      });
    }
    
    // Username change flow (only by web developer via OTP)
    if (username && username !== user.username) {
      if (req.user.role !== 'web_developer') {
        return res.status(403).json({ success: false, message: 'Only web developers can change usernames' });
      }
      // Require OTP verification for the web developer's email
      const tokenDoc = await OtpToken.findOne({ email: req.user.email, purpose: 'change_username', used: false, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 });
      if (!tokenDoc) {
        return res.status(400).json({ success: false, message: 'OTP required or expired' });
      }
      const { otp } = req.body;
      const otpValid = await tokenDoc.compareOtp(otp || '');
      if (!otpValid) {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }

      const existing = await User.findOne({ username });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = username;
      tokenDoc.used = true;
      await tokenDoc.save();
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin/Web Developer)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deleting web developer accounts unless they are web developer
    if (user.role === 'web_developer' && req.user.role !== 'web_developer') {
      return res.status(403).json({
        success: false,
        message: 'Only web developers can delete web developer accounts'
      });
    }
    
    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    // Soft delete - set isActive to false
    user.isActive = false;
    await user.save();
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// @desc    Get user statistics (Admin only)
// @route   GET /api/admin/stats
// @access  Private (Admin/Web Developer)
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalAdmins = await User.countDocuments({ role: 'admin', isActive: true });
    const totalDevelopers = await User.countDocuments({ role: 'web_developer', isActive: true });
    const totalRegularUsers = await User.countDocuments({ role: 'user', isActive: true });
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true, isActive: true });
    const unverifiedUsers = await User.countDocuments({ isEmailVerified: false, isActive: true });
    
    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      isActive: true
    });
    
    // Recent logins (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLogins = await User.countDocuments({
      lastLogin: { $gte: sevenDaysAgo },
      isActive: true
    });
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalAdmins,
        totalDevelopers,
        totalRegularUsers,
        verifiedUsers,
        unverifiedUsers,
        recentRegistrations,
        recentLogins
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
};

// @desc    Bulk update user roles (Admin only)
// @route   PUT /api/admin/users/bulk-update
// @access  Private (Admin/Web Developer)
export const bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, updates } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }
    
    const allowedUpdates = ['role', 'permissions', 'isActive'];
    const updateData = {};
    
    // Filter allowed updates
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided'
      });
    }
    
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updateData }
    );
    
    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} users successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update users'
    });
  }
};

// @desc    Get user activity log (Admin only)
// @route   GET /api/admin/users/:id/activity
// @access  Private (Admin/Web Developer)
export const getUserActivity = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email lastLogin createdAt loginAttempts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // In a real application, you might have a separate Activity model
    // For now, we'll return basic user activity data
    const activity = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      activity: {
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        loginAttempts: user.loginAttempts,
        isLocked: user.isLocked
      }
    };
    
    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity'
    });
  }
};
