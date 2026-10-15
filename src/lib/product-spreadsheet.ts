import * as XLSX from "xlsx";
import { normalizeEAN } from "./ean";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_PRODUCT_ROWS = 500;
const aliases = {
  nome_produto: ["nome_produto", "nome do produto", "produto", "nome", "descrição"],
  categoria: ["categoria"],
  unidade_medida: ["unidade_medida", "unidade", "un"],
  preco: ["preco", "preço", "preço (r$)", "valor"],
  ean: ["ean", "gtin", "código de barras", "codigo de barras"],
} as const;
type Column = keyof typeof aliases;
const columns = Object.keys(aliases) as Column[];
const labels: Record<Column, string> = { nome_produto: "Nome do produto", categoria: "Categoria", unidade_medida: "Unidade", preco: "Preço", ean: "EAN" };
const headerKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_]+/g, "");

export type IgnoredRow = { line: number; reason: string };
export type SpreadsheetProduct = { nome_produto: string; categoria: string; unidade_medida: string; preco: number; ean: string | null };

function csvSeparator(text: string) {
  let quoted = false, commas = 0, semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted) {
      if (c === "\n" || c === "\r") break;
      if (c === ",") commas++;
      if (c === ";") semicolons++;
    }
  }
  return semicolons > commas ? ";" : ",";
}

export function parseProductSpreadsheet(bytes: ArrayBuffer, filename: string) {
  const csv = /\.csv$/i.test(filename);
  if (!csv && !/\.xlsx$/i.test(filename)) throw new Error("Envie um arquivo .csv ou .xlsx.");
  if (bytes.byteLength === 0) throw new Error("O arquivo está vazio.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("O arquivo deve ter no máximo 1 MB.");
  const buffer = Buffer.from(bytes);
  if (!csv && (buffer.length < 2 || buffer.readUInt16LE(0) !== 0x4b50)) throw new Error("Arquivo XLSX inválido.");
  let text = "";
  if (csv) {
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, ""); }
    catch { throw new Error("Codificação inválida. Salve o CSV em UTF-8, com ou sem BOM."); }
  }
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(csv ? text : buffer, {
      type: csv ? "string" : "buffer", raw: true, cellFormula: true,
      ...(csv ? { FS: csvSeparator(text) } : {}),
      sheetRows: MAX_PRODUCT_ROWS + 2, sheets: 0,
    });
    if (!csv && workbook.bookType !== "xlsx") throw new Error("Invalid format");
  } catch { throw new Error("Não foi possível ler a planilha. Use o modelo CSV ou um arquivo XLSX válido."); }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"]) throw new Error("A planilha está vazia.");
  const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
  if (range.e.r > MAX_PRODUCT_ROWS) throw new Error("A planilha deve ter no máximo 500 linhas de produtos, além do cabeçalho.");
  const indexes: Partial<Record<Column, number>> = {};
  const unknown: string[] = [];
  for (let c = 0; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({r: 0, c})];
    if (cell?.f || cell?.t === "e") throw new Error("Cabeçalho inválido: fórmulas e erros não são aceitos nos nomes das colunas.");
    const title = String(cell?.v ?? "").trim();
    const key = headerKey(title);
    const column = columns.find((name) => aliases[name].some((alias) => headerKey(alias) === key));
    if (column) {
      if (indexes[column] !== undefined) throw new Error(`Coluna duplicada: ${labels[column]}. Mantenha apenas uma coluna para esse campo.`);
      indexes[column] = c;
    } else unknown.push(title || `coluna ${XLSX.utils.encode_col(c)} sem nome`);
  }
  const missing = (["nome_produto", "preco"] as const).filter((name) => indexes[name] === undefined);
  if (missing.length) throw new Error(missing.map((name) => `Coluna obrigatória ausente: ${labels[name]}. Nomes aceitos: ${aliases[name].join(", ")}.`).join(" "));
  const warnings = unknown.length ? [`Colunas ignoradas: ${unknown.join(", ")}`] : [];
  const products: SpreadsheetProduct[] = [];
  const ignored: IgnoredRow[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const cells = columns.map((name) => indexes[name] === undefined ? undefined : sheet[XLSX.utils.encode_cell({r, c: indexes[name]!})]);
    const values = cells.map((cell) => String(cell?.v ?? "").trim());
    if (values.every((v) => !v) && !cells.some((cell) => cell?.f)) continue;
    const [nome_produto, categoria, unidade_medida, priceText, eanText] = values;
    const problems: string[] = [];
    columns.forEach((name, i) => {
      if (cells[i]?.f || cells[i]?.t === "e") problems.push(`${labels[name]}: fórmulas ou erros de planilha não são aceitos; envie os valores`);
      if (i < 3 && values[i].length > 160) problems.push(`${labels[name]}: texto acima de 160 caracteres`);
    });
    if (!nome_produto) problems.push("Nome do produto: preenchimento obrigatório");
    const normalizedPrice = priceText.replace(/^R\$\s*/i, "").trim().replace(",", ".");
    const preco = Number(normalizedPrice);
    if (!priceText) problems.push("Preço: preenchimento obrigatório");
    else if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalizedPrice) || !Number.isFinite(preco) || preco <= 0) problems.push("Preço: preço inválido; use um número positivo com até duas casas decimais (ex.: 32,90 ou R$ 32.90), sem separador de milhar");
    let ean: string | null = null;
    try { ean = normalizeEAN(eanText); }
    catch (error) { problems.push(error instanceof Error ? error.message : "EAN: código inválido"); }
    if (problems.length) ignored.push({line: r + 1, reason: problems.join("; ")});
    else products.push({nome_produto, categoria, unidade_medida, preco, ean});
  }
  return { products, ignored, warnings };
}
