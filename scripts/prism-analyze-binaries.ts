/**
 * WinPRISM binary static-analysis pass.
 *
 * Reads the raw strings dumps under docs/prism/strings/ (produced by
 * scripts/prism-extract-strings.ps1) and parses them into a structured
 * inventory of every SQL operation, stored proc, view, and table reference
 * embedded in each WinPRISM binary.
 *
 * Output:
 *   docs/prism/static/catalog.json     — full machine-readable inventory
 *   docs/prism/static/catalog.md       — per-binary summary table
 *   docs/prism/static/by-table.md      — table → binaries that touch it
 *   docs/prism/static/by-proc.md       — proc → binaries that call it
 *   docs/prism/static/by-view.md       — view → binaries that query it
 *
 * Pure file-I/O. Does not connect to Prism. Safe to run anywhere.
 *
 * Usage:
 *   npx tsx scripts/prism-analyze-binaries.ts
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const STRINGS_DIR = path.join(ROOT, "docs", "prism", "strings");
const OUT_DIR = path.join(ROOT, "docs", "prism", "static");

type Op = "INSERT" | "UPDATE" | "DELETE" | "SELECT" | "EXEC" | "MERGE";

type SqlStatement = {
  raw: string;
  op: Op;
  primaryTable: string | null;
  tables: string[];
  views: string[];
  procs: string[];
  columns: string[];
  paramCount: number;
};

type BinaryInventory = {
  binary: string;
  totalStrings: number;
  statements: SqlStatement[];
  tableOps: Record<string, Set<Op>>;
  procCalls: Set<string>;
  viewRefs: Set<string>;
  uiMessages: string[];
};

type SerializedBinary = {
  binary: string;
  totalStrings: number;
  statementCount: number;
  byOp: Record<Op, number>;
  tableOps: Record<string, Op[]>;
  procCalls: string[];
  viewRefs: string[];
  uiMessageSample: string[];
  statements: SqlStatement[];
};

const OPS: Op[] = ["INSERT", "UPDATE", "DELETE", "SELECT", "EXEC", "MERGE"];

const RE_INSERT = /\bINSERT\s+INTO\s+(?:dbo\.)?(\[?[A-Za-z_][A-Za-z0-9_]*\]?)\s*(?:\(([^)]+)\))?/i;
const RE_UPDATE = /\bUPDATE\s+(?:dbo\.)?(\[?[A-Za-z_][A-Za-z0-9_]*\]?)\b/i;
const RE_DELETE = /\bDELETE\s+(?:FROM\s+)?(?:dbo\.)?(\[?[A-Za-z_][A-Za-z0-9_]*\]?)\b/i;
const RE_FROM = /\bFROM\s+(?:dbo\.)?(\[?[A-Za-z_][A-Za-z0-9_]*\]?)/gi;
const RE_JOIN = /\bJOIN\s+(?:dbo\.)?(\[?[A-Za-z_][A-Za-z0-9_]*\]?)/gi;
const RE_EXEC = /\bEXEC(?:UTE)?\s+(?:dbo\.)?([A-Za-z_][A-Za-z0-9_]+)/gi;
const RE_VIEW_REF = /\b(VW_[A-Za-z0-9_]+|V_[A-Za-z0-9_]+)\b/g;
const RE_PROC_LIKE = /^(?:SP_|sp_|fn_|FN_|CMD_|E_|P_P|P_|NB_|NBC|NMR|MarkDown|Royalty|Catalog|Media|Resend|Rental|Inventory)[A-Za-z0-9_]+$/;
const RE_PARAM = /(%(?:ld|d|s|f|i|u|x|X|lu|li))/g;

const VIEW_PREFIXES = ["VW_", "V_"];

function readStrings(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.length > 0);
}

function unbracket(name: string): string {
  return name.replace(/^\[/, "").replace(/\]$/, "");
}

function isViewName(name: string): boolean {
  return VIEW_PREFIXES.some((p) => name.toUpperCase().startsWith(p));
}

function classifyOp(stmt: string): Op | null {
  const s = stmt.trim().toUpperCase();
  if (/^INSERT\s+INTO\b/.test(s)) return "INSERT";
  if (/^UPDATE\b/.test(s)) return "UPDATE";
  if (/^DELETE\b/.test(s)) return "DELETE";
  if (/^MERGE\b/.test(s)) return "MERGE";
  if (/^SELECT\b/.test(s)) return "SELECT";
  if (/^EXEC(UTE)?\b/.test(s)) return "EXEC";
  return null;
}

function parseStatement(raw: string): SqlStatement | null {
  const op = classifyOp(raw);
  if (!op) return null;

  const tables = new Set<string>();
  const views = new Set<string>();
  const procs = new Set<string>();
  const columns: string[] = [];
  let primaryTable: string | null = null;

  if (op === "INSERT") {
    const m = raw.match(RE_INSERT);
    if (m) {
      primaryTable = unbracket(m[1]);
      if (isViewName(primaryTable)) views.add(primaryTable);
      else tables.add(primaryTable);
      if (m[2]) columns.push(...m[2].split(",").map((c) => c.trim()));
    }
  } else if (op === "UPDATE") {
    const m = raw.match(RE_UPDATE);
    if (m) {
      primaryTable = unbracket(m[1]);
      if (isViewName(primaryTable)) views.add(primaryTable);
      else tables.add(primaryTable);
    }
  } else if (op === "DELETE") {
    const m = raw.match(RE_DELETE);
    if (m) {
      primaryTable = unbracket(m[1]);
      if (isViewName(primaryTable)) views.add(primaryTable);
      else tables.add(primaryTable);
    }
  } else if (op === "EXEC") {
    const m = raw.match(/\bEXEC(?:UTE)?\s+(?:dbo\.)?([A-Za-z_][A-Za-z0-9_]+)/i);
    if (m) {
      primaryTable = m[1];
      procs.add(m[1]);
    }
  }

  // Pick up additional tables from FROM/JOIN regardless of op
  for (const m of Array.from(raw.matchAll(RE_FROM))) {
    const t = unbracket(m[1]);
    if (isViewName(t)) views.add(t);
    else tables.add(t);
  }
  for (const m of Array.from(raw.matchAll(RE_JOIN))) {
    const t = unbracket(m[1]);
    if (isViewName(t)) views.add(t);
    else tables.add(t);
  }
  // Procs called inline (sub-EXECs)
  for (const m of Array.from(raw.matchAll(RE_EXEC))) {
    procs.add(m[1]);
  }
  // Bare VW_/V_ references in subqueries
  for (const m of Array.from(raw.matchAll(RE_VIEW_REF))) {
    views.add(m[1]);
  }

  const paramCount = (raw.match(RE_PARAM) || []).length;

  return {
    raw,
    op,
    primaryTable,
    tables: Array.from(tables),
    views: Array.from(views),
    procs: Array.from(procs),
    columns,
    paramCount,
  };
}

function isLikelyUiMessage(s: string): boolean {
  // English sentences with spaces, ending in . ? or !, no SQL keywords up front
  if (s.length < 12 || s.length > 240) return false;
  if (/^[A-Z_]+$/.test(s)) return false;
  if (/(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|EXEC)\b/i.test(s)) return false;
  if (!/\s/.test(s)) return false;
  if (!/[a-z]/.test(s)) return false;
  return /[.?!]\s*$/.test(s) || /[A-Z][a-z].*[a-z]\s+[a-z]/.test(s);
}

function analyzeBinary(binary: string): BinaryInventory {
  const stringsFile = path.join(STRINGS_DIR, `${binary}.strings.txt`);
  const all = readStrings(stringsFile);

  const statements: SqlStatement[] = [];
  const tableOps: Record<string, Set<Op>> = {};
  const procCalls = new Set<string>();
  const viewRefs = new Set<string>();
  const uiMessages: string[] = [];

  for (const line of all) {
    const stmt = parseStatement(line);
    if (stmt) {
      statements.push(stmt);
      if (stmt.primaryTable && stmt.op !== "EXEC" && !isViewName(stmt.primaryTable)) {
        if (!tableOps[stmt.primaryTable]) tableOps[stmt.primaryTable] = new Set();
        tableOps[stmt.primaryTable].add(stmt.op);
      }
      for (const t of stmt.tables) {
        if (!tableOps[t]) tableOps[t] = new Set();
        // Tables seen via FROM/JOIN count as SELECT exposure
        tableOps[t].add("SELECT");
      }
      for (const v of stmt.views) viewRefs.add(v);
      for (const p of stmt.procs) procCalls.add(p);
    } else {
      // Standalone proc references
      if (RE_PROC_LIKE.test(line)) procCalls.add(line);
      // Standalone view references
      if (/^(VW_|V_)[A-Za-z0-9_]+$/.test(line)) viewRefs.add(line);
      // UI messages
      if (isLikelyUiMessage(line)) uiMessages.push(line);
    }
  }

  return {
    binary,
    totalStrings: all.length,
    statements,
    tableOps,
    procCalls,
    viewRefs,
    uiMessages,
  };
}

function serialize(inv: BinaryInventory): SerializedBinary {
  const byOp: Record<Op, number> = { INSERT: 0, UPDATE: 0, DELETE: 0, SELECT: 0, EXEC: 0, MERGE: 0 };
  for (const s of inv.statements) byOp[s.op] = (byOp[s.op] ?? 0) + 1;

  const tableOps: Record<string, Op[]> = {};
  for (const [t, ops] of Object.entries(inv.tableOps)) {
    tableOps[t] = Array.from(ops).sort();
  }

  return {
    binary: inv.binary,
    totalStrings: inv.totalStrings,
    statementCount: inv.statements.length,
    byOp,
    tableOps,
    procCalls: Array.from(inv.procCalls).sort(),
    viewRefs: Array.from(inv.viewRefs).sort(),
    uiMessageSample: inv.uiMessages.slice(0, 50),
    statements: inv.statements,
  };
}

function discoverBinaries(): string[] {
  if (!fs.existsSync(STRINGS_DIR)) return [];
  return fs
    .readdirSync(STRINGS_DIR)
    .filter((f) => f.endsWith(".strings.txt"))
    .map((f) => f.replace(/\.strings\.txt$/, ""))
    .sort();
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeCatalogMd(rows: SerializedBinary[]) {
  const lines: string[] = [];
  lines.push("# WinPRISM binary catalog (static analysis)");
  lines.push("");
  lines.push("Per-binary summary of SQL/proc/view references extracted from the WinPRISM client binaries.");
  lines.push("Source: `docs/prism/strings/<binary>.strings.txt` (raw extraction).");
  lines.push("");
  lines.push("| Binary | Strings | Stmts | INS | UPD | DEL | SEL | EXEC | Tables | Procs | Views |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of rows) {
    lines.push(
      `| ${r.binary} | ${r.totalStrings} | ${r.statementCount} | ${r.byOp.INSERT} | ${r.byOp.UPDATE} | ${r.byOp.DELETE} | ${r.byOp.SELECT} | ${r.byOp.EXEC} | ${Object.keys(r.tableOps).length} | ${r.procCalls.length} | ${r.viewRefs.length} |`
    );
  }
  return lines.join("\n");
}

function writeByTableMd(rows: SerializedBinary[]) {
  const tableMap: Record<string, { binary: string; ops: Op[] }[]> = {};
  for (const r of rows) {
    for (const [t, ops] of Object.entries(r.tableOps)) {
      if (!tableMap[t]) tableMap[t] = [];
      tableMap[t].push({ binary: r.binary, ops });
    }
  }
  const lines: string[] = [];
  lines.push("# WinPRISM tables → binaries that touch them");
  lines.push("");
  lines.push("Each table entry shows which binaries reference it and with which operations.");
  lines.push("`SELECT` includes any FROM/JOIN exposure; `INSERT`/`UPDATE`/`DELETE` are the binary's actual write paths.");
  lines.push("");
  const tables = Object.keys(tableMap).sort();
  for (const t of tables) {
    lines.push(`## \`${t}\``);
    lines.push("");
    for (const ref of tableMap[t].sort((a, b) => a.binary.localeCompare(b.binary))) {
      lines.push(`- \`${ref.binary}\` — ${ref.ops.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function writeByProcMd(rows: SerializedBinary[]) {
  const procMap: Record<string, string[]> = {};
  for (const r of rows) {
    for (const p of r.procCalls) {
      if (!procMap[p]) procMap[p] = [];
      procMap[p].push(r.binary);
    }
  }
  const lines: string[] = [];
  lines.push("# WinPRISM stored procs → binaries that call them");
  lines.push("");
  lines.push("Includes both `EXEC name` references and standalone proc-name strings (which usually indicate ODBC `{call name(?)}` invocations).");
  lines.push("");
  const procs = Object.keys(procMap).sort();
  for (const p of procs) {
    lines.push(`- \`${p}\` — ${procMap[p].sort().join(", ")}`);
  }
  return lines.join("\n");
}

function writeByViewMd(rows: SerializedBinary[]) {
  const viewMap: Record<string, string[]> = {};
  for (const r of rows) {
    for (const v of r.viewRefs) {
      if (!viewMap[v]) viewMap[v] = [];
      viewMap[v].push(r.binary);
    }
  }
  const lines: string[] = [];
  lines.push("# WinPRISM views → binaries that query them");
  lines.push("");
  const views = Object.keys(viewMap).sort();
  for (const v of views) {
    lines.push(`- \`${v}\` — ${viewMap[v].sort().join(", ")}`);
  }
  return lines.join("\n");
}

function writePerBinaryMd(s: SerializedBinary) {
  const lines: string[] = [];
  lines.push(`# \`${s.binary}\` — static-analysis inventory`);
  lines.push("");
  lines.push(`- Total extracted strings: **${s.totalStrings}**`);
  lines.push(`- Parsed SQL statements: **${s.statementCount}**`);
  lines.push(
    `- Operation breakdown: INSERT=${s.byOp.INSERT}, UPDATE=${s.byOp.UPDATE}, DELETE=${s.byOp.DELETE}, SELECT=${s.byOp.SELECT}, EXEC=${s.byOp.EXEC}, MERGE=${s.byOp.MERGE}`
  );
  lines.push(`- Distinct tables: **${Object.keys(s.tableOps).length}**`);
  lines.push(`- Distinct procs: **${s.procCalls.length}**`);
  lines.push(`- Distinct views: **${s.viewRefs.length}**`);
  lines.push("");

  // Tables grouped by op
  const writeTables: { name: string; ops: Op[] }[] = [];
  for (const [t, ops] of Object.entries(s.tableOps)) writeTables.push({ name: t, ops });
  writeTables.sort((a, b) => a.name.localeCompare(b.name));

  const writers = writeTables.filter((t) => t.ops.some((o) => o === "INSERT" || o === "UPDATE" || o === "DELETE"));
  const readers = writeTables.filter((t) => !writers.find((w) => w.name === t.name));

  lines.push("## Write surface (tables this binary mutates)");
  lines.push("");
  if (writers.length === 0) lines.push("_None detected._");
  else {
    lines.push("| Table | Ops |");
    lines.push("|---|---|");
    for (const w of writers) lines.push(`| \`${w.name}\` | ${w.ops.join(", ")} |`);
  }
  lines.push("");

  lines.push("## Read surface (tables/views referenced via SELECT/JOIN only)");
  lines.push("");
  if (readers.length === 0) lines.push("_None detected._");
  else {
    lines.push("<details><summary>" + readers.length + " tables</summary>");
    lines.push("");
    for (const r of readers) lines.push(`- \`${r.name}\``);
    lines.push("");
    lines.push("</details>");
  }
  lines.push("");

  lines.push("## Stored procs called");
  lines.push("");
  if (s.procCalls.length === 0) lines.push("_None detected._");
  else {
    for (const p of s.procCalls) lines.push(`- \`${p}\``);
  }
  lines.push("");

  lines.push("## Views referenced");
  lines.push("");
  if (s.viewRefs.length === 0) lines.push("_None detected._");
  else {
    for (const v of s.viewRefs) lines.push(`- \`${v}\``);
  }
  lines.push("");

  // Group write statements by table
  const writesByTable: Record<string, SqlStatement[]> = {};
  for (const stmt of s.statements) {
    if (stmt.op !== "INSERT" && stmt.op !== "UPDATE" && stmt.op !== "DELETE") continue;
    if (!stmt.primaryTable) continue;
    if (!writesByTable[stmt.primaryTable]) writesByTable[stmt.primaryTable] = [];
    writesByTable[stmt.primaryTable].push(stmt);
  }
  if (Object.keys(writesByTable).length > 0) {
    lines.push("## Write statements (verbatim)");
    lines.push("");
    const tables = Object.keys(writesByTable).sort();
    for (const t of tables) {
      lines.push(`### \`${t}\``);
      lines.push("");
      for (const stmt of writesByTable[t]) {
        lines.push("```sql");
        lines.push(stmt.raw);
        lines.push("```");
        lines.push("");
      }
    }
  }

  // Sample UI strings to hint at features
  if (s.uiMessageSample.length > 0) {
    lines.push("## UI message sample (first 50)");
    lines.push("");
    lines.push("These suggest user-facing features the binary implements.");
    lines.push("");
    for (const m of s.uiMessageSample) lines.push(`- ${m}`);
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, "binaries"));

  const binaries = discoverBinaries();
  if (binaries.length === 0) {
    console.error(`No strings dumps found at ${STRINGS_DIR}. Run prism-extract-strings.ps1 first.`);
    process.exit(1);
  }

  const all = binaries.map(analyzeBinary);
  const serialized = all.map(serialize);

  fs.writeFileSync(path.join(OUT_DIR, "catalog.json"), JSON.stringify(serialized, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "catalog.md"), writeCatalogMd(serialized) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "by-table.md"), writeByTableMd(serialized) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "by-proc.md"), writeByProcMd(serialized) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "by-view.md"), writeByViewMd(serialized) + "\n");

  for (const s of serialized) {
    fs.writeFileSync(path.join(OUT_DIR, "binaries", `${s.binary}.md`), writePerBinaryMd(s) + "\n");
  }

  console.log(`Analyzed ${binaries.length} binaries`);
  console.log(`Wrote catalog.json + catalog.md + by-{table,proc,view}.md + binaries/*.md to ${OUT_DIR}`);
  for (const s of serialized) {
    console.log(
      `  ${s.binary.padEnd(30)} stmts=${s.statementCount.toString().padStart(4)}  tbl=${Object.keys(s.tableOps).length.toString().padStart(3)}  proc=${s.procCalls.length.toString().padStart(3)}  view=${s.viewRefs.length.toString().padStart(3)}`
    );
  }
}

main();
