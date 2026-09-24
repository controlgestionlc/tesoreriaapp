import { File } from "node:buffer";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseExcel } from "../lib/excel";
import type { Data } from "../lib/treasury";

const emptyData: Data = {
  companies: [{ id: "empresa1", name: "Empresa", rut: "776847003" }],
  accounts: [],
  partners: [],
  entries: [],
  payments: [],
};

async function registroFile() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hoja1");
  sheet.addRow(["TIPO", "DOCUMENTO", "NUMERO DOC", "FECHA EMISION", "VENCIMIENTO", "RUT ", "AUXILIAR", "IMPORTE A PAGAR"]);
  sheet.addRow(["EGRESO", "FACTURA", 100, new Date("2026-06-17T00:00:00Z"), new Date("2026-07-17T00:00:00Z"), "77090370-K", "EMPRESAS BIOSUR SPA", 286052]);
  sheet.addRow(["EGRESO", "FACTURA", 101, new Date("2026-06-18T00:00:00Z"), new Date("2026-07-18T00:00:00Z"), "", "EMPRESAS BIOSUR SPA", 100000]);
  sheet.addRow(["INGRESO", "FACTURA", 3188, new Date("2026-09-22T00:00:00Z"), new Date("2026-10-22T00:00:00Z"), "76923764-K", "FORESTAL RIO HUEQUEN SPA", 3040283]);
  sheet.addRow(["EGRESO", "REMUNERACIONES", "", new Date("2026-09-01T00:00:00Z"), new Date("2026-09-10T00:00:00Z"), "77684700-3", "PERSONAL INTERNO", 100000000]);
  const bytes = await workbook.xlsx.writeBuffer();
  return new File([bytes], "REGISTRO FLUJO CAJA.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) as unknown as globalThis.File;
}

describe("importación Excel", () => {
  it("acepta REGISTRO FLUJO CAJA y prepara auxiliares nuevos", async () => {
    const rows = await parseExcel(await registroFile(), "empresa1", "all", emptyData);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => !row.error)).toBe(true);
    expect(rows[0].category).toBe("Proveedores");
    expect(rows[0].newPartner.rut).toBe("77090370K");
    expect(rows[1].partnerId).toBe(rows[0].partnerId);
    expect(rows[2].category).toBe("Clientes");
    expect(rows[3].category).toBe("Remuneraciones");
    expect(rows[3].partnerId).toBeNull();
  });

  it("informa el dígito verificador esperado", async () => {
    const file = await registroFile();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.worksheets[0].addRow(["INGRESO", "FACTURA", 3187, new Date("2026-09-21T00:00:00Z"), new Date("2026-10-21T00:00:00Z"), "77238972-2", "SOCIEDAD LA CAMPESTRE", 18580279]);
    const bytes = await workbook.xlsx.writeBuffer();
    const invalid = new File([bytes], "REGISTRO FLUJO CAJA.xlsx") as unknown as globalThis.File;
    const rows = await parseExcel(invalid, "empresa1", "all", emptyData);
    expect(rows.at(-1)?.error).toContain("dígito verificador esperado es 8");
  });
});
