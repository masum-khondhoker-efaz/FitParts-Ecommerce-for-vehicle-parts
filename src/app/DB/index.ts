import { UserRoleEnum, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import config from '../../config';
import prisma from '../utils/prisma';

const superAdminData = {
  fullName: 'Super Admin',
  email: 'admin@gmail.com',
  password: '',
  role: UserRoleEnum.SUPER_ADMIN,
  status: UserStatus.ACTIVE,
  isProfileComplete: true,
  isVerified: true,
};

const seedSuperAdmin = async () => {
  try {
    // ✅ Check if a super admin already exists
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        Admin: {
          is: { role: UserRoleEnum.SUPER_ADMIN, isSuperAdmin: true },
        },
      },
    });

    if (!isSuperAdminExists) {
      // Hash password
      superAdminData.password = await bcrypt.hash(
        config.super_admin_password as string,
        Number(config.bcrypt_salt_rounds) || 12,
      );

      // ✅ Create User with role
      const superAdmin = await prisma.user.create({
        data: {
          fullName: superAdminData.fullName,
          email: superAdminData.email,
          password: superAdminData.password,
          status: superAdminData.status,
          isProfileComplete: superAdminData.isProfileComplete,
          isVerified: superAdminData.isVerified,
        },
      });

      // ✅ Create Admin record
      const admin = await prisma.admin.create({
        data: {
          userId: superAdmin.id,
          isSuperAdmin: true,
          role: UserRoleEnum.SUPER_ADMIN,
          systemOwner: true,
        },
      });

      console.log('Super Admin created:', superAdmin);
      console.log('Admin created:', admin);
    } else {
      console.log('ℹ️ Super Admin already exists.');
    }

    // ✅ Ensure roles exist
    const roles = [
      UserRoleEnum.SUPER_ADMIN,
      UserRoleEnum.ADMIN,
      UserRoleEnum.BUYER,
      UserRoleEnum.SELLER,
    ];

    const existingRoles = await prisma.role.findMany({
      where: { name: { in: roles } },
    });

    const existingRoleNames = existingRoles.map(r => r.name);
    const rolesToCreate = roles.filter(r => !existingRoleNames.includes(r));

    // If some roles are missing, create them
    if (rolesToCreate.length > 0) {
      for (const role of rolesToCreate) {
        await prisma.role.upsert({
          where: { name: role },
          update: {},
          create: { name: role },
        });
      }
      console.log('✅ Missing roles seeded successfully');
    } 
    // check super admin role exists in userRole model
    const superAdminRole = await prisma.userRole.findFirst({
      where: {
        userId: isSuperAdminExists ? isSuperAdminExists.id : undefined,
        role: {
          name: UserRoleEnum.SUPER_ADMIN,
        },
      },
    });

    if (!superAdminRole && isSuperAdminExists) {
      await prisma.userRole.create({
        data: {
          userId: isSuperAdminExists.id,
          roleId: (
            await prisma.role.findFirst({
              where: { name: UserRoleEnum.SUPER_ADMIN },
            })
          )?.id as string,
        },
      });
      console.log('✅ Super Admin role assigned to existing super admin user');
    }

    // create seller profile for super admin if not exists
    const superAdminSellerProfile = await prisma.sellerProfile.findFirst({
      where: {
        userId: isSuperAdminExists ? isSuperAdminExists.id : undefined,
        isSellerInfoComplete: true,
      },
    });

    if (!superAdminSellerProfile && isSuperAdminExists) {
      await prisma.sellerProfile.create({
        data: {
          userId: isSuperAdminExists.id,
          companyName: 'Super Admin Company',
          address: '123 Admin St, Admin City, Admin Country',
          contactInfo: '1234567890',
          isSellerInfoComplete: true,
        },
      });
      console.log('✅ Seller profile created for Super Admin');
    }
    

    else {
      console.log('ℹ️ All roles already exist');
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
  }
};

export default seedSuperAdmin;
