import Link from "next/link";
import { PAGE_SIZE } from "@/lib/pagination";

type Props = {
  page: number;
  total: number;
  param: string;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
};

export function Pagination({ page, total, param, searchParams, basePath }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => {
    const query = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      const single = Array.isArray(value) ? value[0] : value;
      if (single !== undefined && key !== param) query.set(key, single);
    });
    query.set(param, String(target));
    return `${basePath}?${query.toString()}`;
  };

  return (
    <nav aria-label="Pagination" style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1rem" }}>
      {page > 1 ? <Link href={href(page - 1)}>← Newer</Link> : <span style={{ opacity: 0.4 }}>← Newer</span>}
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      {page < totalPages ? <Link href={href(page + 1)}>Older →</Link> : <span style={{ opacity: 0.4 }}>Older →</span>}
    </nav>
  );
}
