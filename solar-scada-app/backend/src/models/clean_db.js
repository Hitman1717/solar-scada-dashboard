import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('=================================================');
  console.log('CLEANING POSTGRESQL DATABASE...');
  console.log('=================================================');

  try {
    // Delete in dependency order
    console.log('Deleting dependent table records...');
    await prisma.plant_users.deleteMany();
    await prisma.company_variables.deleteMany();
    await prisma.audit_logs.deleteMany();
    await prisma.plant_issues.deleteMany();
    await prisma.telemetry.deleteMany();
    await prisma.plant_tables.deleteMany();
    await prisma.website_accounts.deleteMany();
    await prisma.website_providers.deleteMany();
    await prisma.plants.deleteMany();
    await prisma.users.deleteMany();
    await prisma.companies.deleteMany();
    
    console.log('All records deleted successfully.');

    // Reset SERIAL sequences
    console.log('Resetting database ID serial sequences...');
    await prisma.$executeRawUnsafe(`
      SELECT setval('companies_id_seq', 1, false);
      SELECT setval('users_id_seq', 1, false);
      SELECT setval('plants_id_seq', 1, false);
      SELECT setval('website_providers_id_seq', 1, false);
      SELECT setval('website_accounts_id_seq', 1, false);
      SELECT setval('plant_tables_id_seq', 1, false);
      SELECT setval('telemetry_id_seq', 1, false);
      SELECT setval('plant_issues_id_seq', 1, false);
      SELECT setval('audit_logs_id_seq', 1, false);
      SELECT setval('company_variables_id_seq', 1, false);
    `);
    console.log('All ID sequences reset back to 1.');

    // Seed website providers
    console.log('Seeding predefined website providers...');
    await prisma.website_providers.createMany({
      data: [
        { id: 1, provider_name: 'Polycab', oem_key: 'polycab', login_url: 'https://polycab.com', description: 'Polycab monitoring API' },
        { id: 2, provider_name: 'Solis', oem_key: 'solis', login_url: 'https://solisinverters.com', description: 'Solis Cloud API portal' },
        { id: 3, provider_name: 'Solax', oem_key: 'solax', login_url: 'https://solaxcloud.com', description: 'Solax portal scraper' }
      ]
    });

    // Seed solitary Super Admin user
    console.log('Seeding solitary Super Admin user...');
    const hashedPassword = bcrypt.hashSync('password', 10);
    const superAdmin = await prisma.users.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@msl.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        is_active: true
      }
    });

    console.log('=================================================');
    console.log(`SUCCESS! Database cleaned. Super Admin created:`);
    console.log(`Email: ${superAdmin.email}`);
    console.log(`Password: password`);
    console.log('=================================================');

  } catch (error) {
    console.error('Failed to clean database:', error);
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
