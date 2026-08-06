require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Banner = require('../models/Banner');

async function seed() {
  await connectDB();

  const adminEmail = 'admin@dexline.store';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: 'Dexline Admin',
      email: adminEmail,
      password: 'Admin@123',
      role: 'admin',
      phone: '9999999999',
    });
    console.log(`Admin created: ${adminEmail} / Admin@123`);
  } else {
    console.log('Admin already exists, skipping.');
  }

  const categoryNames = ['Laptops', 'Desktops & Computers', 'Networking', 'Office Equipment', 'Accessories'];
  const categories = {};
  for (const name of categoryNames) {
    let category = await Category.findOne({ name });
    if (!category) {
      category = await Category.create({ name });
      console.log(`Category created: ${name}`);
    }
    categories[name] = category;
  }

  const existingProductCount = await Product.countDocuments();
  if (existingProductCount === 0) {
    await Product.insertMany([
      {
        name: '14" Business Laptop — Core i5, 8GB RAM, 256GB SSD',
        category: categories['Laptops']._id,
        price: 54999,
        compareAtPrice: 61999,
        images: [
          'https://picsum.photos/seed/dexline-laptop-1/800/800',
          'https://picsum.photos/seed/dexline-laptop-2/800/800',
        ],
        description: 'Slim business laptop with an 11th-gen Core i5, 8GB RAM, 256GB SSD and a full-HD display. Ideal for office work and light multitasking.',
        stock: 12,
        isFeatured: true,
      },
      {
        name: '15.6" Everyday Laptop — Core i3, 8GB RAM, 512GB SSD',
        category: categories['Laptops']._id,
        price: 39999,
        images: ['https://picsum.photos/seed/dexline-laptop-3/800/800'],
        description: 'Reliable everyday laptop for browsing, documents and video calls, with a spacious 512GB SSD.',
        stock: 18,
      },
      {
        name: 'Mini Tower Desktop PC — Core i5, 16GB RAM, 512GB SSD',
        category: categories['Desktops & Computers']._id,
        price: 47999,
        images: ['https://picsum.photos/seed/dexline-desktop-1/800/800'],
        description: 'Compact desktop tower built for office productivity — Core i5, 16GB RAM, 512GB SSD, Windows 11 Pro ready.',
        stock: 10,
      },
      {
        name: '24" Full HD Monitor',
        category: categories['Desktops & Computers']._id,
        price: 8999,
        images: ['https://picsum.photos/seed/dexline-monitor-1/800/800'],
        description: 'IPS full-HD monitor with slim bezels, HDMI + VGA input — a solid companion for any desktop setup.',
        stock: 30,
      },
      {
        name: '24-Port Gigabit Network Switch',
        category: categories['Networking']._id,
        price: 12499,
        images: ['https://picsum.photos/seed/dexline-switch-1/800/800'],
        description: 'Unmanaged 24-port Gigabit switch for growing office networks — plug-and-play, rack mountable.',
        stock: 14,
        isFeatured: true,
      },
      {
        name: 'Dual-Band Wi-Fi 6 Router',
        category: categories['Networking']._id,
        price: 6499,
        compareAtPrice: 7999,
        images: ['https://picsum.photos/seed/dexline-router-1/800/800'],
        description: 'Wi-Fi 6 router with dual-band coverage, ideal for small offices and busy households.',
        stock: 22,
      },
      {
        name: 'A4 All-in-One Laser Printer',
        category: categories['Office Equipment']._id,
        price: 15999,
        images: ['https://picsum.photos/seed/dexline-printer-1/800/800'],
        description: 'Print, scan and copy laser all-in-one with network + Wi-Fi connectivity for the whole office.',
        stock: 9,
      },
      {
        name: 'Ergonomic Mesh Office Chair',
        category: categories['Office Equipment']._id,
        price: 10999,
        images: ['https://picsum.photos/seed/dexline-chair-1/800/800'],
        description: 'Breathable mesh-back office chair with adjustable lumbar support and armrests.',
        stock: 20,
        isFeatured: true,
      },
      {
        name: 'Wireless Keyboard & Mouse Combo',
        category: categories['Accessories']._id,
        price: 1799,
        images: ['https://picsum.photos/seed/dexline-combo-1/800/800'],
        description: 'Slim wireless keyboard and mouse combo with a shared USB receiver — quiet keys, long battery life.',
        stock: 45,
      },
      {
        name: '1TB Portable External SSD',
        category: categories['Accessories']._id,
        price: 7499,
        images: ['https://picsum.photos/seed/dexline-ssd-1/800/800'],
        description: 'Pocket-sized 1TB external SSD with USB-C, fast transfer speeds for backups and file sharing.',
        stock: 26,
      },
    ]);
    console.log('Sample products created.');
  } else {
    console.log('Products already exist, skipping.');
  }

  const existingBannerCount = await Banner.countDocuments();
  if (existingBannerCount === 0) {
    await Banner.insertMany([
      {
        image: 'https://picsum.photos/seed/dexline-hero-1/1600/900',
        badge: 'IT hardware sourced from 60+ trusted suppliers',
        title: 'Laptops, desktops, office & networking gear — sorted on WhatsApp.',
        description: 'Browse the catalog, add to cart, and check out straight to WhatsApp — no card, no hassle.',
        buttonText: 'Shop Now',
        linkHref: '/#catalog',
        order: 1,
      },
      {
        image: 'https://picsum.photos/seed/dexline-hero-2/1600/900',
        badge: 'For the whole office',
        title: 'Fit out your office in one order.',
        description: 'Laptops, desktops, printers and office furniture, all from one supplier.',
        buttonText: 'Shop Office Equipment',
        linkHref: '/#catalog',
        order: 2,
      },
      {
        image: 'https://picsum.photos/seed/dexline-hero-3/1600/900',
        badge: 'Networking',
        title: 'Upgrade your network without the hassle.',
        description: 'Routers, switches and access points for offices of any size.',
        buttonText: 'Shop Networking',
        linkHref: '/#catalog',
        order: 3,
      },
      {
        image: 'https://picsum.photos/seed/dexline-hero-4/1600/900',
        badge: 'New stock weekly',
        title: 'Fresh laptop deals, every week.',
        description: 'New arrivals and price drops added regularly across the catalog.',
        buttonText: 'Shop Laptops',
        linkHref: '/#catalog',
        order: 4,
      },
    ]);
    console.log('Sample banners created.');
  } else {
    console.log('Banners already exist, skipping.');
  }

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
