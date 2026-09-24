import { describe, expect, it } from "vitest";
import { addDays, addMonths, balance, cleanRut, validRut, type Data } from "../lib/treasury";

describe("reglas básicas de tesorería", () => {
  it("normaliza y valida RUT chilenos", () => {
    expect(cleanRut("12.345.678-5")).toBe("123456785");
    expect(validRut("12.345.678-5")).toBe(true);
    expect(validRut("12.345.678-4")).toBe(false);
  });

  it("calcula días y cuotas mensuales sin desbordar febrero", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("calcula el saldo con cobros y pagos efectivos", () => {
    const data: Data = {
      companies: [{ id: "c1", name: "Empresa", rut: "123456785" }],
      accounts: [{ id: "a1", companyId: "c1", bank: "Banco", number: "1", opening: 1000, openingDate: "2026-01-01" }],
      partners: [],
      entries: [
        { id: "e1", companyId: "c1", accountId: "a1", partnerId: null, direction: "ingreso", category: "Otros ingresos", docType: "Otro", docNumber: "", description: "Ingreso", issueDate: "2026-01-02", dueDate: "2026-01-02", amount: 500 },
        { id: "e2", companyId: "c1", accountId: "a1", partnerId: null, direction: "egreso", category: "Otros egresos", docType: "Otro", docNumber: "", description: "Egreso", issueDate: "2026-01-02", dueDate: "2026-01-02", amount: 300 },
      ],
      payments: [
        { id: "p1", entryId: "e1", accountId: "a1", date: "2026-01-03", amount: 500, note: "" },
        { id: "p2", entryId: "e2", accountId: "a1", date: "2026-01-04", amount: 300, note: "" },
      ],
    };
    expect(balance(data.accounts[0], data, "2026-01-04")).toBe(1200);
  });
});
