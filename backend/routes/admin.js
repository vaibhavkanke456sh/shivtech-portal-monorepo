import express from 'express';
import { body, query } from 'express-validator';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  bulkUpdateUsers,
  getUserActivity,
  createAdminAccount,
  createUserAccount,
  changeUsername,
  deleteAccount
} from '../controllers/adminController.js';
import { authenticateToken, requireRole, requirePermission, requireWebDeveloper } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const createUserValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .trim(),
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .trim(),
  body('role')
    .isIn(['user', 'admin', 'web_developer'])
    .withMessage('Invalid role specified'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
];

const updateUserValidation = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .trim(),
  body('role')
    .optional()
    .isIn(['user', 'admin', 'web_developer'])
    .withMessage('Invalid role specified'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

const bulkUpdateValidation = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs must be a non-empty array'),
  body('userIds.*')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  body('updates')
    .isObject()
    .withMessage('Updates must be an object')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['user', 'admin', 'web_developer'])
    .withMessage('Invalid role filter'),
  query('search')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Search query cannot be empty')
];

// All routes require authentication and admin/developer role
router.use(authenticateToken);
router.use(requireRole(['admin', 'web_developer']));

// User management routes
router.get('/users', queryValidation, getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', requirePermission('manage_users'), createUserValidation, createUser);
router.put('/users/:id', requirePermission('manage_users'), updateUserValidation, updateUser);
// Deleting users via generic endpoint requires web developer
router.delete('/users/:id', requireWebDeveloper, deleteUser);

// Statistics and analytics routes
router.get('/stats', requirePermission('view_analytics'), getUserStats);

// Bulk operations routes
router.put('/users/bulk-update', requirePermission('manage_users'), bulkUpdateValidation, bulkUpdateUsers);

// User activity routes
router.get('/users/:id/activity', requirePermission('view_analytics'), getUserActivity);

// Explicit API endpoints per requirements
router.post('/create-admin', authenticateToken, requireWebDeveloper, [
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').isLength({ min: 1, max: 50 }).trim(),
  body('lastName').isLength({ min: 1, max: 50 }).trim()
], createAdminAccount);

router.post('/create-user', authenticateToken, requireRole(['admin','web_developer']), [
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').isLength({ min: 1, max: 50 }).trim(),
  body('lastName').isLength({ min: 1, max: 50 }).trim()
], createUserAccount);

router.patch('/change-username', authenticateToken, requireWebDeveloper, [
  body('userId').isMongoId(),
  body('newUsername').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('otp').isLength({ min: 6, max: 6 })
], changeUsername);

router.delete('/delete-account/:id', authenticateToken, requireWebDeveloper, deleteAccount);

export default router;
