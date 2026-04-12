import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { defaultPrintPricingConfig } from "../src/domains/print-pricing/defaults";

for (const envFile of [".env.local", ".env"]) {
  dotenv.config({
    path: path.join(process.cwd(), envFile),
    override: false,
    quiet: true,
  });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin", 10);
  const e2eUsername = process.env.E2E_USERNAME?.trim().toLowerCase();
  const e2ePassword = process.env.E2E_PASSWORD?.trim();

  await prisma.user.upsert({
    where: { username: "admin" },
    update: { role: "admin" },
    create: {
      username: "admin",
      passwordHash,
      name: "Administrator",
      role: "admin",
      setupComplete: true,
    },
  });

  if (e2eUsername && e2ePassword) {
    const e2ePasswordHash = await bcrypt.hash(e2ePassword, 10);

    await prisma.user.upsert({
      where: { username: e2eUsername },
      update: {
        email: e2eUsername,
        role: "admin",
        active: true,
        passwordHash: e2ePasswordHash,
        setupComplete: true,
      },
      create: {
        username: e2eUsername,
        email: e2eUsername,
        passwordHash: e2ePasswordHash,
        name: "E2E Admin",
        role: "admin",
        active: true,
        setupComplete: true,
      },
    });

    console.log(`Seeded E2E admin user: ${e2eUsername}`);
  }

  // Seed staff from original config
  const staffData = [
    { name: "Anafe Robinson", title: "Financial Aid Coordinator", department: "Student Services", extension: "x6516" },
    { name: "Ara Aguilar", title: "President", department: "Office of the President", extension: "x6408" },
    { name: "Candy Van", title: "College Store Manager", department: "Admin Services", extension: "x2854" },
    { name: "Claudia Velasco", title: "Dean", department: "Student Services", extension: "x4210" },
    { name: "Donna-Mae Villanueva", title: "Dean", department: "Academic Affairs", extension: "x4407" },
    { name: "Geremy Mason", title: "Brahma Bodega Coordinator", department: "Student Services", extension: "x2934" },
    { name: "Jason Cifra", title: "Vice President", department: "Student Services", extension: "x2911" },
    { name: "Juan-Carlos Astorga", title: "Dean", department: "Student Services", extension: "x2248" },
    { name: "Kalynda McLean", title: "UMOJA Coordinator", department: "Student Services", extension: "x6567" },
    { name: "Mary Anne Gavarra", title: "Dean", department: "Academic Affairs", extension: "x2234" },
    { name: "Mary J Jo Apigo", title: "Vice President", department: "Academic Affairs", extension: "x2281" },
    { name: "Mofe Doyle", title: "Senior Admin Analyst", department: "Admin Services", extension: "x2553" },
    { name: "Mon Khat", title: "Dean", department: "Academic Affairs", extension: "x2693" },
    { name: "Paul Neiman", title: "Director of Facilities", department: "Admin Services", extension: "x4121" },
    { name: "Rolf Schleicher", title: "Vice President", department: "Admin Services", extension: "x4121" },
    { name: "Ron Paquette", title: "Associate Vice President", department: "Admin Services", extension: "x6543" },
    { name: "Sharon Dalmage", title: "Dean", department: "Academic Affairs", extension: "x2523" },
    { name: "Debrah Hefner", title: "Athletic Director", department: "Student Services", extension: "x4234" },
    { name: "Susan Rhi-Klienert", title: "Dean", department: "Academic Affairs", extension: "x2289" },
    { name: "Tatevik Melkumyan", title: "Coordinator of MultiCultural Center", department: "Student Services", extension: "x4942" },
    { name: "William Marmolejo", title: "Dean", department: "Student Services", extension: "x2955" },
  ];

  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { id: s.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: s.name.toLowerCase().replace(/\s+/g, "-"),
        name: s.name,
        title: s.title,
        department: s.department,
        accountCode: "",
        extension: s.extension,
        email: "",
        phone: "",
      },
    });
  }

  // Seed categories
  const categories = [
    { name: "COPY_TECH", label: "CopyTech" },
    { name: "CATERING", label: "Catering" },
    { name: "SUPPLIES", label: "Supplies" },
    { name: "DEPARTMENT_PURCHASE", label: "Department Purchase" },
  ];
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // Seed default global quick picks
  // Remove legacy tax quick pick (replaced by proper tax system)
  await prisma.quickPickItem.deleteMany({
    where: { id: "default-ca-state-tax" },
  });

  const defaultQuickPicks = [
    { id: "default-shipping-fee", department: "__ALL__", description: "Shipping Fee", defaultPrice: 0 },
    { id: "default-service-fee", department: "__ALL__", description: "Service Fee", defaultPrice: 0 },
  ];

  for (const qp of defaultQuickPicks) {
    await prisma.quickPickItem.upsert({
      where: { id: qp.id },
      update: {},
      create: qp,
    });
  }
  console.log("Seeded default quick picks");

  const printPricingConfig = await prisma.printPricingConfig.upsert({
    where: { id: "default" },
    update: {
      shopTitle: defaultPrintPricingConfig.shopTitle,
      quotePrefix: defaultPrintPricingConfig.quotePrefix,
      quoteDisclaimer: defaultPrintPricingConfig.quoteDisclaimer,
      taxEnabled: defaultPrintPricingConfig.taxEnabled,
      taxRateBasisPoints: defaultPrintPricingConfig.taxRateBasisPoints,
      bwDuplexMultiplierBasisPoints: defaultPrintPricingConfig.bwDuplexMultiplierBasisPoints,
      colorDuplexMultiplierBasisPoints: defaultPrintPricingConfig.colorDuplexMultiplierBasisPoints,
    },
    create: {
      id: "default",
      shopTitle: defaultPrintPricingConfig.shopTitle,
      quotePrefix: defaultPrintPricingConfig.quotePrefix,
      quoteDisclaimer: defaultPrintPricingConfig.quoteDisclaimer,
      taxEnabled: defaultPrintPricingConfig.taxEnabled,
      taxRateBasisPoints: defaultPrintPricingConfig.taxRateBasisPoints,
      bwDuplexMultiplierBasisPoints: defaultPrintPricingConfig.bwDuplexMultiplierBasisPoints,
      colorDuplexMultiplierBasisPoints: defaultPrintPricingConfig.colorDuplexMultiplierBasisPoints,
    },
  });

  await prisma.printPricingTier.deleteMany({
    where: { configId: printPricingConfig.id },
  });

  await prisma.printPricingTier.createMany({
    data: [
      ...defaultPrintPricingConfig.copyTiers.BW.map((tier) => ({
        configId: printPricingConfig.id,
        service: "COPY" as const,
        variant: tier.variant,
        label: tier.label,
        description: tier.description,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        unitPriceCents: tier.unitPriceCents,
        sortOrder: tier.sortOrder,
      })),
      ...defaultPrintPricingConfig.copyTiers.COLOR.map((tier) => ({
        configId: printPricingConfig.id,
        service: "COPY" as const,
        variant: tier.variant,
        label: tier.label,
        description: tier.description,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        unitPriceCents: tier.unitPriceCents,
        sortOrder: tier.sortOrder,
      })),
      ...defaultPrintPricingConfig.scanTiers.map((tier) => ({
        configId: printPricingConfig.id,
        service: "SCANNING" as const,
        variant: tier.variant,
        label: tier.label,
        description: tier.description,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        unitPriceCents: tier.unitPriceCents,
        sortOrder: tier.sortOrder,
      })),
      ...Object.values(defaultPrintPricingConfig.posterTiers).map((tier) => ({
        configId: printPricingConfig.id,
        service: "POSTER" as const,
        variant: tier.variant,
        label: tier.label,
        description: tier.description,
        minQuantity: null,
        maxQuantity: null,
        unitPriceCents: tier.unitPriceCents,
        sortOrder: tier.sortOrder,
      })),
      ...Object.values(defaultPrintPricingConfig.bindingTiers).map((tier) => ({
        configId: printPricingConfig.id,
        service: "BINDING" as const,
        variant: tier.variant,
        label: tier.label,
        description: tier.description,
        minQuantity: null,
        maxQuantity: null,
        unitPriceCents: tier.unitPriceCents,
        sortOrder: tier.sortOrder,
      })),
      {
        configId: printPricingConfig.id,
        service: "SCANNING" as const,
        variant: "MINIMUM_CHARGE",
        label: "Minimum Scan Charge",
        description: "Minimum charge applied to low-volume scanning jobs.",
        minQuantity: null,
        maxQuantity: null,
        unitPriceCents: defaultPrintPricingConfig.minimumScanChargeCents,
        sortOrder: 999,
      },
    ],
  });
  console.log("Seeded print pricing configuration");

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
