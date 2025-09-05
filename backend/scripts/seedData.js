import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const seedUsers = [
  {
    username: 'Shivowner_4567',
    email: 'vaibhavkanke2004@gmail.com',
    password: 'LifeQWER#$123',
    firstName: 'Shiv',
    lastName: 'Owner',
    role: 'web_developer',
    permissions: [
      'read_dashboard',
      'write_dashboard',
      'manage_users',
      'manage_admins',
      'manage_developers',
      'view_analytics',
      'manage_content',
      'system_settings'
    ],
    isEmailVerified: true,
    isActive: true
  },
  {
    username: 'admin',
    email: 'admin@dsamportal.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    permissions: [
      'read_dashboard',
      'write_dashboard',
      'manage_users',
      'view_analytics',
      'manage_content'
    ],
    isEmailVerified: true,
    isActive: true
  },
  {
    username: 'developer',
    email: 'developer@dsamportal.com',
    password: 'Developer123!',
    firstName: 'Web',
    lastName: 'Developer',
    role: 'web_developer',
    permissions: [
      'read_dashboard',
      'write_dashboard',
      'manage_users',
      'manage_admins',
      'manage_developers',
      'view_analytics',
      'manage_content',
      'system_settings'
    ],
    isEmailVerified: true,
    isActive: true
  },
  {
    username: 'user1',
    email: 'user1@dsamportal.com',
    password: 'User123!',
    firstName: 'Regular',
    lastName: 'User',
    role: 'user',
    permissions: ['read_dashboard'],
    isEmailVerified: true,
    isActive: true
  },
  {
    username: 'user2',
    email: 'user2@dsamportal.com',
    password: 'User123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    permissions: ['read_dashboard'],
    isEmailVerified: false,
    isActive: true
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Hash passwords and create users
    const hashedUsers = await Promise.all(
      seedUsers.map(async (userData) => {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        return {
          ...userData,
          password: hashedPassword
        };
      })
    );

    // Insert users
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`Created ${createdUsers.length} users`);

    // Display created users
    console.log('\nCreated users:');
    createdUsers.forEach(user => {
      console.log(`- ${user.role.toUpperCase()}: ${user.username} (${user.email})`);
      console.log(`  Password: ${seedUsers.find(u => u.username === user.username).password}`);
    });

    console.log('\n✅ Database seeded successfully!');
    console.log('\nYou can now test the login with these credentials:');
    console.log('🔐 Admin: admin@dsamportal.com / Admin123!');
    console.log('👨‍💻 Developer: developer@dsamportal.com / Developer123!');
    console.log('👤 User: user1@dsamportal.com / User123!');
    console.log('📧 Unverified: user2@dsamportal.com / User123!');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the seed function
seedDatabase();
