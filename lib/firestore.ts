import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "./firebase";
import {
  addMonths,
  blank,
  cleanRut,
  validRut,
  type Data,
  type Entry,
  type Partner,
} from "./treasury";

type CollectionName = keyof Data;
const names: CollectionName[] = ["companies", "accounts", "partners", "entries", "payments"];

function db() {
  if (!firestore) throw new Error("Firebase no está configurado. Revise el archivo .env.local.");
  return firestore;
}

function path(uid: string, name: CollectionName) {
  return collection(db(), "users", uid, name);
}

function rows(snapshot: { docs: Array<{ id: string; data(): DocumentData }> }) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function loadTreasury(uid: string): Promise<Data> {
  const snapshots = await Promise.all(names.map((name) => getDocs(path(uid, name))));
  return names.reduce((all, name, index) => {
    (all[name] as unknown[]) = rows(snapshots[index]);
    return all;
  }, structuredClone(blank));
}

export function subscribeTreasury(
  uid: string,
  onData: (data: Data) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const current = structuredClone(blank);
  const initialized = new Set<CollectionName>();
  const subscriptions = names.map((name) =>
    onSnapshot(
      path(uid, name),
      (snapshot) => {
        (current[name] as unknown[]) = rows(snapshot);
        initialized.add(name);
        if (initialized.size === names.length) onData(structuredClone(current));
      },
      (error) => onError(error),
    ),
  );
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}

function integer(value: unknown, label: string, allowNegative = false) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || (!allowNegative && number <= 0)) {
    throw new Error(`${label} debe ser un número entero${allowNegative ? "" : " positivo"}.`);
  }
  return number;
}

function required(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Debe indicar ${label}.`);
  return text;
}

function date(value: unknown, label: string) {
  const text = String(value ?? "");
  const parsed = new Date(`${text}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${label} no es válida.`);
  }
  return text;
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newId(uid: string, name: CollectionName) {
  return doc(path(uid, name)).id;
}

function entryValues(raw: any, data: Data) {
  const companyId = required(raw.companyId, "la empresa");
  if (!data.companies.some((company) => company.id === companyId)) throw new Error("Seleccione una empresa válida.");
  const direction = raw.direction === "ingreso" ? "ingreso" : raw.direction === "egreso" ? "egreso" : "";
  if (!direction) throw new Error("Seleccione ingreso o egreso.");
  const category = required(raw.category, "el concepto");
  if (category === "Clientes" && direction !== "ingreso") throw new Error("Clientes requiere un ingreso.");
  if (category === "Proveedores" && direction !== "egreso") throw new Error("Proveedores requiere un egreso.");
  const accountId = raw.accountId ? String(raw.accountId) : null;
  if (accountId && !data.accounts.some((account) => account.id === accountId && account.companyId === companyId)) {
    throw new Error("La cuenta no pertenece a la empresa.");
  }
  const issueDate = date(raw.issueDate, "La fecha de emisión");
  const dueDate = date(raw.dueDate, "La fecha de vencimiento");
  if (dueDate < issueDate) throw new Error("El vencimiento no puede ser anterior a la emisión.");
  const isDocument = category === "Clientes" || category === "Proveedores";
  let partnerId = raw.partnerId ? String(raw.partnerId) : null;
  const docNumber = String(raw.docNumber ?? "").trim();
  if (isDocument) {
    const role = direction === "ingreso" ? "Cliente" : "Proveedor";
    const partner = data.partners.find((item) => item.id === partnerId && item.companyId === companyId);
    if (!partner || (partner.role !== role && partner.role !== "Ambos")) throw new Error(`Seleccione un ${role.toLowerCase()} válido.`);
    if (!docNumber) throw new Error("Debe indicar el número de documento.");
  } else partnerId = null;
  const docType = required(raw.docType, "el tipo de documento");
  const duplicateKey = isDocument
    ? [companyId, direction, partnerId, docType.toLowerCase(), docNumber.toLowerCase()].join("|")
    : "";
  return {
    companyId,
    accountId,
    partnerId,
    direction,
    category,
    docType,
    docNumber,
    description: String(raw.description ?? "").trim(),
    issueDate,
    dueDate,
    amount: integer(raw.amount, "El monto"),
    duplicateKey,
    paidAmount: Number(raw.paidAmount ?? 0),
  };
}

export async function mutateTreasury(uid: string, input: any, data: Data) {
  const database = db();
  if (input.action === "company") {
    const name = required(input.name, "la razón social");
    const rut = cleanRut(required(input.rut, "el RUT"));
    if (!validRut(rut)) throw new Error("RUT inválido: revise el dígito verificador.");
    if (data.companies.some((item) => item.rut === rut && item.id !== input.id)) throw new Error("Ya existe una empresa con ese RUT.");
    const id = input.id || newId(uid, "companies");
    await setDoc(doc(path(uid, "companies"), id), { name, rut });
    return;
  }

  if (input.action === "account") {
    const companyId = required(input.companyId, "la empresa");
    if (!data.companies.some((company) => company.id === companyId)) throw new Error("Seleccione una empresa válida.");
    const opening = integer(input.opening, "El saldo inicial", true);
    const openingDate = date(input.openingDate, "La fecha del saldo inicial");
    if (input.id && data.payments.some((payment) => payment.accountId === input.id)) {
      const old = data.accounts.find((account) => account.id === input.id);
      if (old && (old.opening !== opening || old.openingDate !== openingDate)) {
        throw new Error("La cuenta tiene movimientos: no puede cambiar el saldo inicial ni su fecha.");
      }
    }
    const bank = required(input.bank, "el banco");
    const number = required(input.number, "el número de cuenta");
    if (data.accounts.some((item) => item.companyId === companyId && item.bank === bank && item.number === number && item.id !== input.id)) {
      throw new Error("La cuenta ya existe en esta empresa.");
    }
    const id = input.id || newId(uid, "accounts");
    await setDoc(doc(path(uid, "accounts"), id), { companyId, bank, number, opening, openingDate });
    return;
  }

  if (input.action === "partner") {
    const companyId = required(input.companyId, "la empresa");
    const name = required(input.name, "el nombre del auxiliar");
    const rut = cleanRut(required(input.rut, "el RUT"));
    if (!validRut(rut)) throw new Error("RUT inválido: revise el dígito verificador.");
    if (!["Cliente", "Proveedor", "Ambos"].includes(input.role)) throw new Error("Seleccione un tipo de auxiliar válido.");
    if (data.partners.some((item) => item.companyId === companyId && item.rut === rut && item.id !== input.id)) {
      throw new Error("Ya existe un auxiliar con ese RUT en la empresa.");
    }
    const id = input.id || newId(uid, "partners");
    await setDoc(doc(path(uid, "partners"), id), { companyId, name, rut, role: input.role });
    return;
  }

  if (input.action === "entry" || input.action === "import") {
    const rawRows = input.action === "import" ? input.rows : [input];
    if (!Array.isArray(rawRows) || !rawRows.length || rawRows.length > 300) throw new Error("La carga debe contener entre 1 y 300 documentos.");
    const importedPartnerMap = new Map<string, Partner>();
    if (input.action === "import") {
      for (const raw of rawRows) {
        if (!raw.newPartner) continue;
        const candidate = raw.newPartner;
        const id = required(candidate.id, "el identificador del auxiliar");
        const companyId = required(candidate.companyId, "la empresa del auxiliar");
        const name = required(candidate.name, "el nombre del auxiliar");
        const rut = cleanRut(required(candidate.rut, "el RUT del auxiliar"));
        if (!data.companies.some((company) => company.id === companyId)) throw new Error("La empresa del auxiliar no existe.");
        if (!validRut(rut)) throw new Error(`RUT inválido para ${name}.`);
        if (!["Cliente", "Proveedor", "Ambos"].includes(candidate.role)) throw new Error("El rol del auxiliar importado no es válido.");
        if (id !== `aux_${companyId}_${rut}` || id.includes("/")) throw new Error("El identificador del auxiliar importado no es válido.");
        if (raw.partnerId !== id) throw new Error("El documento no coincide con su auxiliar importado.");
        const previous = importedPartnerMap.get(id);
        if (previous && (previous.companyId !== companyId || previous.rut !== rut || previous.name !== name)) {
          throw new Error(`Hay datos contradictorios para el auxiliar ${name}.`);
        }
        importedPartnerMap.set(id, {
          id,
          companyId,
          name,
          rut,
          role: previous && previous.role !== candidate.role ? "Ambos" : candidate.role,
        });
      }
    }
    const importedPartners = [...importedPartnerMap.values()];
    const partnerById = new Map(data.partners.map((partner) => [partner.id, partner]));
    importedPartners.forEach((partner) => partnerById.set(partner.id, partner));
    const validationData: Data = { ...data, partners: [...partnerById.values()] };
    const prepared: Array<{ id: string; oldId?: string; values: ReturnType<typeof entryValues> }> = [];
    const duplicateIds = new Set<string>();
    for (const raw of rawRows) {
      const values = entryValues(raw, validationData);
      const installments = Math.max(1, Math.min(60, integer(raw.installments ?? 1, "Las cuotas")));
      if (raw.id && installments !== 1) throw new Error("Edite las cuotas individualmente.");
      if (raw.id && data.payments.some((payment) => payment.entryId === raw.id)) throw new Error("El movimiento tiene abonos y no puede editarse.");
      for (let index = 0; index < installments; index += 1) {
        const installment = {
          ...values,
          docNumber: installments > 1 ? `${values.docNumber || "Cuota"} ${index + 1}/${installments}` : values.docNumber,
          dueDate: addMonths(values.dueDate, index),
        };
        installment.duplicateKey = installment.partnerId
          ? [installment.companyId, installment.direction, installment.partnerId, installment.docType.toLowerCase(), installment.docNumber.toLowerCase()].join("|")
          : "";
        const desiredId = installment.duplicateKey ? `doc_${await hash(installment.duplicateKey)}` : raw.id || newId(uid, "entries");
        if (duplicateIds.has(desiredId)) throw new Error("Hay documentos duplicados dentro del archivo.");
        duplicateIds.add(desiredId);
        prepared.push({ id: desiredId, oldId: raw.id && raw.id !== desiredId ? raw.id : undefined, values: installment });
      }
    }
    if (prepared.length + importedPartners.length > 450) {
      throw new Error("La carga contiene demasiados documentos y auxiliares nuevos. Divídala en dos archivos.");
    }
    await runTransaction(database, async (transaction) => {
      const partnerRefs = importedPartners.map((partner) => doc(path(uid, "partners"), partner.id));
      const entryRefs = prepared.map((item) => doc(path(uid, "entries"), item.id));
      const [partnerSnapshots, existing] = await Promise.all([
        Promise.all(partnerRefs.map((reference) => transaction.get(reference))),
        Promise.all(entryRefs.map((reference) => transaction.get(reference))),
      ]);
      prepared.forEach((item, index) => {
        const sameExisting = item.oldId ? false : input.action === "entry" && input.id === item.id;
        if (existing[index].exists() && !sameExisting) throw new Error(`Documento duplicado: ${item.values.docNumber}.`);
      });
      importedPartners.forEach((partner, index) => {
        const snapshot = partnerSnapshots[index];
        if (!snapshot.exists()) {
          transaction.set(partnerRefs[index], {
            companyId: partner.companyId,
            name: partner.name,
            rut: partner.rut,
            role: partner.role,
          });
          return;
        }
        const stored = snapshot.data() as Omit<Partner, "id">;
        if (stored.companyId !== partner.companyId || cleanRut(stored.rut) !== partner.rut) {
          throw new Error(`Existe un auxiliar incompatible con el identificador de ${partner.name}.`);
        }
        const role = stored.role === partner.role || stored.role === "Ambos" ? stored.role : "Ambos";
        transaction.set(partnerRefs[index], { role }, { merge: true });
      });
      prepared.forEach((item) => {
        if (item.oldId) transaction.delete(doc(path(uid, "entries"), item.oldId));
        transaction.set(doc(path(uid, "entries"), item.id), item.values);
      });
    });
    return;
  }

  if (input.action === "pay") {
    const entryId = required(input.entryId, "el documento");
    const accountId = required(input.accountId, "la cuenta bancaria");
    const paymentDate = date(input.date, "La fecha efectiva");
    const amount = integer(input.amount, "El monto del abono");
    const id = required(input.id, "el identificador del abono");
    await runTransaction(database, async (transaction) => {
      const paymentRef = doc(path(uid, "payments"), id);
      const entryRef = doc(path(uid, "entries"), entryId);
      const [existingPayment, entrySnapshot] = await Promise.all([transaction.get(paymentRef), transaction.get(entryRef)]);
      if (existingPayment.exists()) return;
      if (!entrySnapshot.exists()) throw new Error("El documento ya no existe.");
      const entry = entrySnapshot.data() as Entry & { paidAmount?: number };
      const account = data.accounts.find((item) => item.id === accountId && item.companyId === entry.companyId);
      if (!account) throw new Error("La cuenta no pertenece a la empresa.");
      if (paymentDate < account.openingDate || paymentDate < entry.issueDate) throw new Error("La fecha es anterior al saldo inicial o a la emisión.");
      const paidAmount = Number(entry.paidAmount ?? 0);
      if (amount > entry.amount - paidAmount) throw new Error("El abono supera el saldo pendiente.");
      transaction.set(paymentRef, { entryId, accountId, date: paymentDate, amount, note: String(input.note ?? "") });
      transaction.update(entryRef, { paidAmount: paidAmount + amount });
    });
    return;
  }

  if (input.action === "deleteEntry") {
    const id = required(input.id, "el documento");
    const ref = doc(path(uid, "entries"), id);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return;
    if (Number(snapshot.data().paidAmount ?? 0) > 0 || data.payments.some((payment) => payment.entryId === id)) {
      throw new Error("No se puede eliminar un documento con abonos.");
    }
    await deleteDoc(ref);
    return;
  }

  throw new Error("Acción no válida.");
}
