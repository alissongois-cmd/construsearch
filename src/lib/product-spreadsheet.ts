import * as XLSX from "xlsx";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_PRODUCT_ROWS = 500;
const columns = ["nome_produto", "categoria", "unidade_medida", "preco"] as const;

export type IgnoredRow = { line: number; reason: string };
export type SpreadsheetProduct = {
  nome_produto: string;
  categoria: string;
  unidade_medida: string;
  preco: number;
};

export function parseProductSpreadsheet(bytes: ArrayBuffer, filename: string) {
  const csv = /\.csv$/i.test(filename);
  if (!csv && !/\.xlsx$/i.test(filename)) throw new Error("Envie um arquivo .csv ou .xlsx.");
  if (bytes.byteLength === 0) throw new Error("O arquivo está vazio.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("O arquivo deve ter no máximo 1 MB.");
  const buffer = Buffer.from(bytes);
  // XLSX is a ZIP archive. Prevent renamed text/legacy Excel files from being accepted.
  if (!csv && (buffer.length < 2 || buffer.readUInt16LE(0) !== 0x4b50)) throw new Error("Arquivo XLSX inválido.");
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(csv ? buffer.toString("utf8").replace(/^\uFEFF/, "") : buffer, {
      type: csv ? "string" : "buffer", raw: true, cellFormula: true,
      // One extra data row is enough to detect and reject an oversized sheet.
      sheetRows: MAX_PRODUCT_ROWS + 2, sheets: 0,
    });
    if (!csv && workbook.bookType !== "xlsx") throw new Error("Invalid format");
  } catch {
    throw new Error("Não foi possível ler a planilha. Use o modelo CSV ou um arquivo XLSX válido.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"]) throw new Error("A planilha está vazia.");
  const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
  if (range.e.r > MAX_PRODUCT_ROWS) throw new Error("A planilha deve ter no máximo 500 linhas de produtos, além do cabeçalho.");
  // Header must be the first row. Extra populated columns usually indicate the wrong template.
  if (range.e.c > columns.length - 1) throw new Error("Use apenas as quatro colunas do modelo de planilha.");
  const headers = columns.map((_, c) => String(sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v ?? "").trim());
  const indexes = columns.map((column) => headers.indexOf(column));
  if (indexes.some((index) => index < 0)) throw new Error(`Cabeçalho inválido. Use: ${columns.join(",")}.`);

  const products: SpreadsheetProduct[] = [];
  const ignored: IgnoredRow[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const cells = indexes.map((c) => sheet[XLSX.utils.encode_cell({ r, c })]);
    const values = cells.map((cell) => String(cell?.v ?? "").trim());
    if (values.every((value) => !value) && !cells.some((cell) => cell?.f)) continue;
    const [nome_produto, categoria, unidade_medida, priceText] = values;
    let reason = "";
    if (cells.some((cell) => cell?.f || cell?.t === "e")) reason = "fórmulas ou erros de planilha não são aceitos; envie os valores";
    else if (!nome_produto) reason = "nome do produto obrigatório";
    else if ([nome_produto, categoria, unidade_medida].some((value) => value.length > 160)) reason = "texto acima de 160 caracteres";
    else if (!priceText) reason = "preço obrigatório";
    const normalizedPrice = priceText.replace(",", ".");
    const preco = Number(normalizedPrice);
    if (!reason && (!/^\d{1,10}(\.\d{1,2})?$/.test(normalizedPrice) || !Number.isFinite(preco) || preco <= 0)) {
      reason = "preço inválido; use um número positivo com até duas casas decimais";
    }
    if (reason) ignored.push({ line: r + 1, reason });
    else products.push({ nome_produto, categoria, unidade_medida, preco });
  }
  return { products, ignored };
}
