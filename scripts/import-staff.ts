/**
 * Import LAPC phone directory CSV into the database.
 * Usage: npx tsx scripts/import-staff.ts /path/to/csv
 *
 * Deletes all existing staff, then imports from CSV.
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function extractExtension(phone: string): string {
  // Get last 4 digits from the phone number as extension
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `x${digits.slice(-4)}`;
}

function cleanPhone(raw: string): string {
  // Take only the first phone number if multiple (split by / or \n)
  const first = raw.split(/[\/\n]/)[0].trim();
  // Normalize to (XXX) XXX-XXXX format
  const digits = first.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return first;
}

function parseName(raw: string): { name: string; title: string } {
  // Input format: "   LastName, FirstName  -  Title" or "   LastName, FirstName"
  const trimmed = raw.replace(/^[\s"]+|[\s"]+$/g, "");

  // Split on " - " or " -  " (dash with surrounding spaces)
  const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    const namePart = dashMatch[1].trim();
    const titlePart = dashMatch[2].trim();
    // Convert "Last, First" to "First Last"
    const commaMatch = namePart.match(/^(.+?),\s*(.+)$/);
    if (commaMatch) {
      return {
        name: `${commaMatch[2].trim()} ${commaMatch[1].trim()}`,
        title: titlePart,
      };
    }
    return { name: namePart, title: titlePart };
  }

  // No title, just name
  const commaMatch = trimmed.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    return {
      name: `${commaMatch[2].trim()} ${commaMatch[1].trim()}`,
      title: "",
    };
  }

  return { name: trimmed, title: "" };
}

interface StaffEntry {
  name: string;
  title: string;
  department: string;
  phone: string;
  extension: string;
  email: string;
}

function parseCSV(csvPath: string): StaffEntry[] {
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");
  const staff: StaffEntry[] = [];
  let currentDepartment = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and header rows
    if (!trimmed || trimmed.startsWith("Department")) continue;

    // Check if this is a department line (no leading whitespace in original, no quotes starting with spaces)
    // Department lines don't start with spaces or quotes-with-spaces
    const isStaffLine =
      line.startsWith("   ") ||
      line.startsWith('"   ') ||
      line.startsWith('"      ');

    if (!isStaffLine) {
      // This is a department header line
      const parts = trimmed.split(",");
      const dept = parts[0].replace(/^["]+|["]+$/g, "").trim();
      // Skip continuation lines (e.g., "VP: (747) 226-5739"), header rows, and empty
      if (dept && dept !== "Department" && !dept.startsWith("VP:") && !dept.match(/^\(\d{3}\)/)) {
        currentDepartment = dept;
      }
      continue;
    }

    // Staff line — parse it
    // Handle quoted fields with commas inside
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of trimmed) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current);

    const nameRaw = fields[0]?.trim() || "";
    const phoneRaw = fields[1]?.trim() || "";
    const emailRaw = fields[2]?.trim() || "";

    // Skip entries with no name or "Vacant"
    if (!nameRaw || nameRaw.toLowerCase().includes("vacant")) continue;
    // Skip entries that are just a title with no name (e.g., "- Dean's Assistant")
    if (nameRaw.startsWith("-") || nameRaw.startsWith("- ")) continue;

    const { name, title } = parseName(nameRaw);

    // Skip if name is too short or is just spaces
    if (name.trim().length < 2) continue;

    const phone = phoneRaw && phoneRaw !== "None" ? cleanPhone(phoneRaw) : "";
    const extension = phone ? extractExtension(phone) : "";
    const email = emailRaw && emailRaw !== "None" ? emailRaw.trim() : "";

    staff.push({
      name: name.trim(),
      title,
      department: currentDepartment,
      phone,
      extension,
      email,
    });
  }

  return staff;
}

async function main() {
  const csvPath =
    process.argv[2] ||
    "/Users/montalvo/Downloads/LAPCPhoneDirectory(ByDepartment).csv";

  console.log(`Parsing CSV: ${csvPath}`);
  const staff = parseCSV(csvPath);
  console.log(`Found ${staff.length} staff entries`);

  // Show a sample
  for (const s of staff.slice(0, 5)) {
    console.log(`  ${s.name} | ${s.title} | ${s.department} | ${s.phone} | ${s.extension} | ${s.email}`);
  }
  console.log("  ...");

  // Soft-delete all existing staff (can't hard delete due to invoice foreign keys)
  const deactivated = await prisma.staff.updateMany({
    where: { active: true },
    data: { active: false },
  });
  console.log(`Deactivated ${deactivated.count} existing staff records`);

  // Insert all new staff
  let created = 0;
  for (const s of staff) {
    try {
      await prisma.staff.create({
        data: {
          name: s.name,
          title: s.title,
          department: s.department,
          accountCode: "",
          phone: s.phone,
          extension: s.extension,
          email: s.email,
        },
      });
      created++;
    } catch (err) {
      console.error(`  Failed to create: ${s.name} — ${err}`);
    }
  }

  console.log(`Created ${created} staff records`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
