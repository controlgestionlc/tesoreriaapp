import { addDays, cleanRut, validRut, type Data, type Partner } from "./treasury";

export const headers = [
  "Tipo",
  "RUT",
  "Nombre",
  "Tipo documento",
  "Número documento",
  "Emisión",
  "Vencimiento",
  "Monto",
  "Descripción",
];

type PartnerDraft = Partner & { isDraft?: boolean };

type Columns = {
  direction: number;
  rut: number;
  name: number;
  docType: number;
  docNumber: number;
  issueDate: number;
  dueDate: number;
  amount: number;
  description: number | null;
};

export async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Documentos");
  sheet.addRow(headers);
  sheet.addRow([
    "Por cobrar",
    "76.123.456-0",
    "Cliente de ejemplo",
    "Factura",
    "1001",
    new Date("2026-09-01T12:00:00Z"),
    new Date("2026-10-01T12:00:00Z"),
    1190000,
    "Venta de ejemplo: eliminar esta fila",
  ]);
  sheet.addRow([
    "Por pagar",
    "76.123.456-0",
    "Proveedor de ejemplo",
    "Factura",
    "2001",
    new Date("2026-09-01T12:00:00Z"),
    new Date("2026-10-01T12:00:00Z"),
    595000,
    "Compra de ejemplo: eliminar esta fila",
  ]);
  sheet.columns.forEach((column, index) => {
    column.width = [18, 20, 34, 20, 23, 16, 16, 20, 50][index];
  });
  sheet.getColumn(6).numFmt = "yyyy-mm-dd";
  sheet.getColumn(7).numFmt = "yyyy-mm-dd";
  sheet.getColumn(8).numFmt = "#,##0";
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A6ED1" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const notes = workbook.addWorksheet("Instrucciones");
  [
    ["Plantilla · Tesorería"],
    ["1. Elimine las dos filas de ejemplo de Documentos."],
    ["2. Tipo: Por cobrar o Por pagar. Montos enteros positivos en CLP."],
    ["3. Use RUT chileno válido. El nombre y el número de documento son obligatorios."],
    ["4. Fechas: celdas de fecha Excel o texto AAAA-MM-DD / DD-MM-AAAA."],
    ["5. Si Vencimiento está vacío, se asignan 30 días desde Emisión."],
    ["6. Los auxiliares inexistentes se crearán automáticamente con el RUT y nombre del archivo."],
    ["7. También se acepta el formato REGISTRO FLUJO CAJA."],
    ["8. Máximo 300 documentos por carga, 3 MB por archivo .xlsx."],
    ["9. Todos ingresan pendientes. Registre cada cobro o pago efectivo por separado."],
    ["10. La empresa y cuenta seleccionadas se aplican a todo el archivo."],
  ].forEach((row) => notes.addRow(row));
  notes.getColumn(1).width = 115;
  save(await workbook.xlsx.writeBuffer(), "Plantilla_Tesoreria.xlsx");
}

export function save(
  buffer: BlobPart,
  name: string,
  type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
) {
  const url = URL.createObjectURL(new Blob([buffer], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cell(value: any): any {
  if (value instanceof Date) return value;
  if (typeof value === "object" && value) {
    return value.result ?? value.text ?? value.richText?.map((part: any) => part.text).join("") ?? "";
  }
  return value ?? "";
}

function normalized(value: unknown) {
  return String(cell(value))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function nameKey(value: unknown) {
  return normalized(value).replace(/[^a-z0-9]/g, "");
}

function date(value: any) {
  const raw = cell(value);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000).toISOString().slice(0, 10);
  }
  let text = String(raw).trim();
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(text)) {
    const [day, month, year] = text.split(/[/-]/);
    text = `${year}-${month}-${day}`;
  }
  const parsed = new Date(`${text}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error("Fecha inválida");
  }
  return text;
}

function direction(value: unknown) {
  const text = normalized(value);
  if (["por cobrar", "ingreso", "cobro"].includes(text)) return "ingreso";
  if (["por pagar", "egreso", "pago"].includes(text)) return "egreso";
  throw new Error("Tipo inválido: use Ingreso/Egreso o Por cobrar/Por pagar");
}

function categoryFor(entryDirection: string, docType: string) {
  const type = normalized(docType);
  if (/prestamo|credito bancario/.test(type)) return "Préstamo bancario";
  if (/leasing/.test(type)) return "Leasing";
  if (/remuner|imposicion|cotizacion previsional/.test(type)) return "Remuneraciones";
  if (/impuesto/.test(type)) return "Impuestos";
  return entryDirection === "ingreso" ? "Clientes" : "Proveedores";
}

function expectedDv(rut: string) {
  const body = cleanRut(rut).slice(0, -1);
  if (!/^\d{7,8}$/.test(body)) return "";
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  return result === 11 ? "0" : result === 10 ? "K" : String(result);
}

function detectColumns(values: any[]): Columns {
  const names = values.map(normalized);
  const at = (...aliases: string[]) => names.findIndex((name) => aliases.includes(name));
  const description = at("descripcion", "glosa");
  const columns: Columns = {
    direction: at("tipo"),
    rut: at("rut"),
    name: at("nombre", "auxiliar"),
    docType: at("tipo documento", "documento"),
    docNumber: at("numero documento", "numero doc", "n° documento", "n documento"),
    issueDate: at("emision", "fecha emision"),
    dueDate: at("vencimiento", "fecha vencimiento"),
    amount: at("monto", "importe a pagar", "importe"),
    description: description < 0 ? null : description,
  };
  const required = [columns.direction, columns.rut, columns.name, columns.docType, columns.docNumber, columns.issueDate, columns.dueDate, columns.amount];
  if (required.some((index) => index < 0)) {
    throw new Error("Las columnas no coinciden con la plantilla ni con REGISTRO FLUJO CAJA.");
  }
  return columns;
}

function amount(value: any) {
  const raw = cell(value);
  const number = typeof raw === "number" ? raw : Number(String(raw).replace(/[$\s.]/g, "").replace(",", "."));
  if (!Number.isSafeInteger(number) || number <= 0 || number > 999999999999) {
    throw new Error("Monto inválido: use pesos enteros positivos");
  }
  return number;
}

function mergeRole(current: string, next: string) {
  return current === next ? current : "Ambos";
}

export async function parseExcel(file: File, companyId: string, accountId: string, data: Data) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Seleccione un archivo .xlsx.");
  if (file.size > 3 * 1024 * 1024) throw new Error("El archivo supera los 3 MB.");

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("Documentos") || workbook.worksheets[0];
  if (!sheet) throw new Error("No se encontró una hoja con documentos.");
  if (sheet.rowCount > 301) throw new Error("Máximo 300 filas por carga.");

  const columns = detectColumns((sheet.getRow(1).values as any[]).slice(1));
  const existing = data.partners.filter((partner) => partner.companyId === companyId);
  const draftsByRut = new Map<string, PartnerDraft>();
  const draftsByName = new Map<string, PartnerDraft>();
  const duplicateKeys = new Set<string>();
  const rows: any[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as any[]).slice(1).map(cell);
    if (values.every((value) => value === "" || value === null)) return;

    const displayName = String(values[columns.name] ?? "").trim();
    const documentNumber = String(values[columns.docNumber] ?? "").trim();
    const result: any = { row: rowNumber, name: displayName, docNumber: documentNumber, amount: 0, error: "" };

    try {
      const entryDirection = direction(values[columns.direction]);
      const docType = String(values[columns.docType] ?? "").trim();
      if (!docType) throw new Error("Falta el tipo de documento o concepto");
      const category = categoryFor(entryDirection, docType);
      const issueDate = date(values[columns.issueDate]);
      const dueDate = values[columns.dueDate] ? date(values[columns.dueDate]) : addDays(issueDate, 30);
      if (dueDate < issueDate) throw new Error("Vencimiento anterior a emisión");
      const entryAmount = amount(values[columns.amount]);
      const requiresPartner = category === "Clientes" || category === "Proveedores";
      const requiredRole = entryDirection === "ingreso" ? "Cliente" : "Proveedor";
      let partner: PartnerDraft | undefined;

      if (requiresPartner) {
        if (!displayName) throw new Error("Falta el nombre del auxiliar");
        const rut = cleanRut(String(values[columns.rut] ?? ""));
        if (rut) {
          if (!validRut(rut)) {
            const dv = expectedDv(rut);
            throw new Error(`RUT inválido${dv ? `: el dígito verificador esperado es ${dv}` : ""}`);
          }
          partner = existing.find((item) => cleanRut(item.rut) === rut) || draftsByRut.get(rut);
          if (!partner) {
            partner = {
              id: `aux_${companyId}_${rut}`,
              companyId,
              name: displayName,
              rut,
              role: requiredRole,
              isDraft: true,
            };
            draftsByRut.set(rut, partner);
            draftsByName.set(nameKey(displayName), partner);
          } else if (partner.isDraft) {
            partner.role = mergeRole(partner.role, requiredRole);
          }
        } else {
          partner = existing.find((item) => nameKey(item.name) === nameKey(displayName)) || draftsByName.get(nameKey(displayName));
          if (!partner) throw new Error("Falta RUT y no se encontró un auxiliar previo con ese nombre");
        }

        if (partner.role !== "Ambos" && partner.role !== requiredRole) {
          throw new Error(`El auxiliar no tiene rol de ${requiredRole.toLowerCase()}`);
        }
        if (!documentNumber) throw new Error("Falta el número de documento");
      }

      const duplicateKey = requiresPartner
        ? [companyId, entryDirection, partner!.id, docType.toLowerCase(), documentNumber.toLowerCase()].join("|")
        : "";
      if (duplicateKey && (duplicateKeys.has(duplicateKey) || data.entries.some((entry) => entry.duplicateKey === duplicateKey))) {
        throw new Error("Documento duplicado");
      }
      if (duplicateKey) duplicateKeys.add(duplicateKey);

      const description = columns.description === null ? "" : String(values[columns.description] ?? "").trim();
      Object.assign(result, {
        companyId,
        accountId: accountId === "all" ? null : accountId,
        partnerId: partner?.id ?? null,
        newPartner: partner?.isDraft ? {
          id: partner.id,
          companyId: partner.companyId,
          name: partner.name,
          rut: partner.rut,
          role: partner.role,
        } : undefined,
        direction: entryDirection,
        category,
        docType,
        docNumber: documentNumber,
        description: description || (requiresPartner ? "" : displayName),
        issueDate,
        dueDate,
        amount: entryAmount,
        installments: 1,
      });
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Fila inválida";
    }
    rows.push(result);
  });

  if (!rows.length) throw new Error("El archivo no contiene documentos.");
  return rows;
}

export async function exportData(data: Data) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(data)) {
    const sheet = workbook.addWorksheet(
      ({ companies: "Empresas", accounts: "Cuentas", partners: "Auxiliares", entries: "Documentos", payments: "Abonos" } as any)[name],
    );
    if (rows.length) {
      const columns = Object.keys(rows[0]);
      sheet.addRow(columns);
      for (const row of rows) sheet.addRow(columns.map((column) => (row as any)[column]));
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((column) => {
        column.width = 24;
      });
    }
  }
  save(await workbook.xlsx.writeBuffer(), "Respaldo_Tesoreria.xlsx");
}
