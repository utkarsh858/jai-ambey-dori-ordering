import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260924000000_manager_item_assignments.sql"),
  "utf8",
);

describe("manager item assignment migration", () => {
  it("creates assignment-scoped tasks with only the non-contact buyer code", () => {
    expect(migration).toContain("create table if not exists public.item_manager_assignments");
    expect(migration).toContain("create_assigned_packing_tasks");
    expect(migration).toContain("alter table public.packing_tasks add column if not exists buyer_code text");
    expect(migration).toContain("factory_order.buyer_code");
    expect(migration).toContain("on conflict (order_id, item_id, assigned_manager_id) do nothing");
  });

  it("keeps inventory adjustments constrained and auditable", () => {
    expect(migration).toContain("adjust_assigned_inventory");
    expect(migration).toContain("Item is not assigned to this manager");
    expect(migration).toContain("Adjustment would make available stock negative");
    expect(migration).toContain("'manager_stock_adjusted'");
  });

  it("does not grant managers buyer-data table policies", () => {
    expect(migration).not.toMatch(/create policy "managers[^"]*"[\s\S]*?on public\.(profiles|orders|order_items|payments)/);
  });
});
