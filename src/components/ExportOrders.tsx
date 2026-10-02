export function ExportOrders() {
  return (
    <form action="/api/orders/export" method="get" style={{ display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "1rem" }}>
      <label>
        Orders from (IST date)
        <br />
        <input type="date" name="from" required />
      </label>
      <button type="submit">Export CSV</button>
    </form>
  );
}
