import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface DccEntry {
  deptNum: number;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
}

export const GET = withAuth(async () => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("dept_num, class_num, cat_num, dept_name, class_name, cat_name")
    .not("dept_num", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const items: DccEntry[] = [];
  for (const row of data ?? []) {
    const r = row as { dept_num: number; class_num: number | null; cat_num: number | null; dept_name: string | null; class_name: string | null; cat_name: string | null };
    const key = `${r.dept_num}.${r.class_num ?? ""}.${r.cat_num ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      deptNum: r.dept_num,
      classNum: r.class_num,
      catNum: r.cat_num,
      deptName: r.dept_name,
      className: r.class_name,
      catName: r.cat_name,
    });
  }
  items.sort((a, b) =>
    a.deptNum - b.deptNum ||
    (a.classNum ?? 0) - (b.classNum ?? 0) ||
    (a.catNum ?? 0) - (b.catNum ?? 0),
  );

  return NextResponse.json({ items }, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
});
