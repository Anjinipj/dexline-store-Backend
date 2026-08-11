require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { categorySlug, productSlug, brandSlug } = require('../src/utils/slug');

const prisma = new PrismaClient();

async function seed() {
  const adminEmail = 'admin@dexline.store';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await prisma.user.create({
      data: {
        name: 'Dexline Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        phone: '9999999999',
      },
    });
    console.log(`Admin created: ${adminEmail} / Admin@123`);
  } else {
    console.log('Admin already exists, skipping.');
  }

  // Representative set only — the source spec calls for 60+ brands; the rest
  // are entered via the admin Brand panel post-launch.
  const brandNames = ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Logitech', 'TP-Link', 'Canon', 'Epson', 'Green Soul'];
  const brands = {};
  for (const name of brandNames) {
    let brand = await prisma.brand.findUnique({ where: { name } });
    if (!brand) {
      brand = await prisma.brand.create({ data: { name, slug: brandSlug(name) } });
      console.log(`Brand created: ${name}`);
    }
    brands[name] = brand;
  }

  const categoryNames = [
    'Networking',
    'Cyber Security',
    'CCTV & Surveillance',
    'Servers & Storage',
    'Computers & Laptops',
    'Access Control',
  ];
  const categories = {};
  for (const name of categoryNames) {
    let category = await prisma.category.findUnique({ where: { name } });
    if (!category) {
      category = await prisma.category.create({ data: { name, slug: categorySlug(name) } });
      console.log(`Category created: ${name}`);
    }
    categories[name] = category;
  }

  const subCategoryDefs = [
    { name: 'Business Laptops', parent: 'Computers & Laptops' },
    { name: 'Gaming Laptops', parent: 'Computers & Laptops' },
    { name: 'Storage', parent: 'Computers & Laptops' },
  ];
  const subCategories = {};
  for (const def of subCategoryDefs) {
    let sub = await prisma.category.findUnique({ where: { name: def.name } });
    if (!sub) {
      sub = await prisma.category.create({
        data: { name: def.name, slug: categorySlug(def.name), parentId: categories[def.parent].id },
      });
      console.log(`Subcategory created: ${def.name} (under ${def.parent})`);
    }
    subCategories[def.name] = sub;
  }

  const existingProductCount = await prisma.product.count();
  if (existingProductCount === 0) {
    const products = [
      {
        name: '14" Business Laptop — Core i5, 8GB RAM, 256GB SSD',
        category: subCategories['Business Laptops'],
        brand: brands['Dell'],
        price: 54999,
        compareAtPrice: 61999,
        images: [
          'https://picsum.photos/seed/dexline-laptop-1/800/800',
          'https://picsum.photos/seed/dexline-laptop-2/800/800',
        ],
        description:
          'Slim business laptop with an 11th-gen Core i5, 8GB RAM, 256GB SSD and a full-HD display. Ideal for office work and light multitasking.',
        stock: 12,
        isFeatured: true,
      },
      {
        name: '15.6" Everyday Laptop — Core i3, 8GB RAM, 512GB SSD',
        category: categories['Computers & Laptops'],
        brand: brands['HP'],
        price: 39999,
        images: ['https://picsum.photos/seed/dexline-laptop-3/800/800'],
        description: 'Reliable everyday laptop for browsing, documents and video calls, with a spacious 512GB SSD.',
        stock: 18,
      },
      {
        name: 'Mini Tower Desktop PC — Core i5, 16GB RAM, 512GB SSD',
        category: categories['Computers & Laptops'],
        brand: brands['Lenovo'],
        price: 47999,
        images: ['https://picsum.photos/seed/dexline-desktop-1/800/800'],
        description:
          'Compact desktop tower built for office productivity — Core i5, 16GB RAM, 512GB SSD, Windows 11 Pro ready.',
        stock: 10,
      },
      {
        name: '24" Full HD Monitor',
        category: categories['Computers & Laptops'],
        brand: brands['Asus'],
        price: 8999,
        images: ['https://picsum.photos/seed/dexline-monitor-1/800/800'],
        description: 'IPS full-HD monitor with slim bezels, HDMI + VGA input — a solid companion for any desktop setup.',
        stock: 30,
      },
      {
        name: '24-Port Gigabit Network Switch',
        category: categories['Networking'],
        brand: brands['TP-Link'],
        price: 12499,
        images: ['https://picsum.photos/seed/dexline-switch-1/800/800'],
        description: 'Unmanaged 24-port Gigabit switch for growing office networks — plug-and-play, rack mountable.',
        stock: 14,
        isFeatured: true,
      },
      {
        name: 'Dual-Band Wi-Fi 6 Router',
        category: categories['Networking'],
        brand: brands['TP-Link'],
        price: 6499,
        compareAtPrice: 7999,
        images: ['https://picsum.photos/seed/dexline-router-1/800/800'],
        description: 'Wi-Fi 6 router with dual-band coverage, ideal for small offices and busy households.',
        stock: 22,
      },
      {
        name: 'A4 All-in-One Laser Printer',
        category: categories['Computers & Laptops'],
        brand: brands['Canon'],
        price: 15999,
        images: ['https://picsum.photos/seed/dexline-printer-1/800/800'],
        description: 'Print, scan and copy laser all-in-one with network + Wi-Fi connectivity for the whole office.',
        stock: 9,
      },
      {
        name: 'Ergonomic Mesh Office Chair',
        category: categories['Computers & Laptops'],
        brand: brands['Green Soul'],
        price: 10999,
        images: ['https://picsum.photos/seed/dexline-chair-1/800/800'],
        description: 'Breathable mesh-back office chair with adjustable lumbar support and armrests.',
        stock: 20,
        isFeatured: true,
      },
      {
        name: 'Wireless Keyboard & Mouse Combo',
        category: categories['Computers & Laptops'],
        brand: brands['Logitech'],
        price: 1799,
        images: ['https://picsum.photos/seed/dexline-combo-1/800/800'],
        description: 'Slim wireless keyboard and mouse combo with a shared USB receiver — quiet keys, long battery life.',
        stock: 45,
      },
      {
        name: '1TB Portable External SSD',
        category: subCategories['Storage'],
        brand: brands['Acer'],
        price: 7499,
        images: ['https://picsum.photos/seed/dexline-ssd-1/800/800'],
        description: 'Pocket-sized 1TB external SSD with USB-C, fast transfer speeds for backups and file sharing.',
        stock: 26,
      },
    ];

    for (const p of products) {
      await prisma.product.create({
        data: {
          name: p.name,
          slug: productSlug(p.name),
          categoryId: p.category.id,
          brandId: p.brand.id,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          images: p.images,
          description: p.description,
          stock: p.stock,
          isFeatured: p.isFeatured ?? false,
        },
      });
    }
    console.log('Sample products created.');
  } else {
    console.log('Products already exist, skipping.');
  }

  const existingBannerCount = await prisma.banner.count();
  if (existingBannerCount === 0) {
    await prisma.banner.createMany({
      data: [
        {
          images: ['https://picsum.photos/seed/dexline-hero-1/1600/900'],
          badge: 'IT hardware sourced from 60+ trusted suppliers',
          title: 'Laptops, desktops, office & networking gear — sorted on WhatsApp.',
          description: 'Browse the catalog, add to cart, and check out straight to WhatsApp — no card, no hassle.',
          buttonText: 'Shop Now',
          linkHref: '/#catalog',
          order: 1,
        },
        {
          images: ['https://picsum.photos/seed/dexline-hero-2/1600/900'],
          badge: 'For the whole office',
          title: 'Fit out your office in one order.',
          description: 'Laptops, desktops, printers and office furniture, all from one supplier.',
          buttonText: 'Shop Office Equipment',
          linkHref: '/#catalog',
          order: 2,
        },
        {
          images: ['https://picsum.photos/seed/dexline-hero-3/1600/900'],
          badge: 'Networking',
          title: 'Upgrade your network without the hassle.',
          description: 'Routers, switches and access points for offices of any size.',
          buttonText: 'Shop Networking',
          linkHref: '/#catalog',
          order: 3,
        },
        {
          images: ['https://picsum.photos/seed/dexline-hero-4/1600/900'],
          badge: 'New stock weekly',
          title: 'Fresh laptop deals, every week.',
          description: 'New arrivals and price drops added regularly across the catalog.',
          buttonText: 'Shop Laptops',
          linkHref: '/#catalog',
          order: 4,
        },
      ],
    });
    console.log('Sample banners created.');
  } else {
    console.log('Banners already exist, skipping.');
  }

  console.log('Seeding complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
