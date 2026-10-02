import { formatIST } from "@/lib/datetime";
import type { OrderDetails, OrderLine } from "@/components/OrderDetailsButton";

export const ORDER_COLUMNS =
  "id,order_number,buyer_code,status,payment_method,total_paise,cancellation_reason,created_at,order_items(item_id,item_name,sku,quantity,unit_price_paise)";

type RawOrder = {
  order_number: string;
  buyer_code?: string | null;
  status: string;
  payment_method?: string | null;
  total_paise: number;
  cancellation_reason?: string | null;
  created_at: string;
  order_items?: (OrderLine & { item_id?: string })[] | null;
};

export function toOrderDetailsWithPacking(order: RawOrder, includeBuyer: boolean, packedItemIds: Set<string> | null): OrderDetails {
  const base = toOrderDetails(order, includeBuyer);
  if (!packedItemIds) return base;
  return { ...base, lines: (order.order_items ?? []).map((l) => ({ ...l, packed: !!l.item_id && packedItemIds.has(l.item_id) })) };
}

export function toOrderDetails(order: RawOrder, includeBuyer: boolean): OrderDetails {
  return {
    order_number: order.order_number,
    status: order.status,
    payment_method: order.payment_method,
    total_paise: order.total_paise,
    created_at_ist: formatIST(order.created_at),
    buyer_code: includeBuyer ? order.buyer_code : null,
    cancellation_reason: order.cancellation_reason,
    lines: (order.order_items ?? []).map(({ item_id: _id, ...rest }) => { void _id; return rest; }),
  };
}
