import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cálculo Rateio Qe 40" },
      {
        name: "description",
        content: "Calculadora de rateio de água do conjunto Qe 40.",
      },
      { property: "og:title", content: "Cálculo Rateio Qe 40" },
      {
        property: "og:description",
        content: "Calculadora de rateio de água do conjunto Qe 40.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Row = {
  id: string;
  unidade: string;
  leituraAnterior: string;
  leituraAtual: string;
  taxaCondominio: string;
  na: boolean;
};

type Column = {
  id: string;
  label: string;
};

const initialColumns: Column[] = [
  { id: "unidade", label: "Unidade" },
  { id: "leituraAnterior", label: "Leitura anterior" },
  { id: "leituraAtual", label: "Leitura atual" },
  { id: "medido", label: "Medido (m³)" },
  { id: "valorAgua", label: "Valor da água" },
  { id: "taxaCondominio", label: "Taxa de condomínio" },
  { id: "totalPagar", label: "Total a pagar" },
];

const DEFAULT_VALOR_CONTA = "R$ 1.683,44";
const DEFAULT_TAXA_CONDOMINIO = "R$ 30,00";
const DEFAULT_TAXA_FIXA = "R$ 22,18";

const STORAGE_KEY = "qe40-rateio:state:v1";
const BACKUP_KEY = "qe40-rateio:backup:v1";
const DEFAULTS_KEY = "qe40-rateio:defaults:v1";

type StoredState = {
  columns: Column[];
  valorConta: string;
  taxaCondominioGlobal: string;
  taxaFixa: string;
  rows: Row[];
};

type ReadingsBackup = {
  savedAt: string;
  rows: Pick<Row, "id" | "leituraAnterior" | "leituraAtual" | "na">[];
};

type SavedDefaults = {
  valorConta: string;
  taxaCondominioGlobal: string;
  taxaFixa: string;
};

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignora falhas de escrita (modo privado, cota excedida, etc.)
  }
}

function removeFromStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignora
  }
}

function parseMoney(value: string): number {
  if (!value || value.trim().toUpperCase() === "N/A") return 0;
  const cleaned = value
    .replace(/R\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Máscara "centavos primeiro": trata os dígitos digitados como centavos e
// reformata a cada tecla, no padrão comum de campos de valor em R$.
function maskCurrencyInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return formatMoney(cents / 100);
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Suporte a colar dois valores de uma vez (ex.: copiados de uma planilha),
// espalhando para a célula colada e a célula à direita, como no Excel.
function splitPastedValues(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function generateDefaultRows(taxaCondominioGlobal: string): Row[] {
  const units: string[] = [];
  for (let floor = 1; floor <= 6; floor++) {
    const maxUnit = floor === 6 ? 3 : 4;
    for (let unit = 1; unit <= maxUnit; unit++) {
      units.push(`${floor}0${unit}`);
    }
  }
  units.push("Loja");

  return units.map((unidade) => ({
    id: uid(),
    unidade,
    leituraAnterior: "",
    leituraAtual: "",
    taxaCondominio: unidade === "Loja" ? "0" : taxaCondominioGlobal,
    na: false,
  }));
}

function Index() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  const [valorConta, setValorConta] = useState<string>(DEFAULT_VALOR_CONTA);
  const [taxaCondominioGlobal, setTaxaCondominioGlobal] = useState<string>(
    DEFAULT_TAXA_CONDOMINIO
  );
  const [taxaFixa, setTaxaFixa] = useState<string>(DEFAULT_TAXA_FIXA);
  const [rows, setRows] = useState<Row[]>(() => generateDefaultRows(DEFAULT_TAXA_CONDOMINIO));
  const [backup, setBackup] = useState<ReadingsBackup | null>(null);
  const hydratedRef = useRef(false);

  // Carrega o estado salvo no navegador (uma única vez, após a primeira renderização,
  // para não gerar divergência entre o HTML do servidor e o do cliente).
  useEffect(() => {
    // Os padrões salvos (via botão "Criar imagem") entram primeiro; o estado
    // completo, salvo a cada alteração, sobrescreve com os valores mais recentes.
    const savedDefaults = loadFromStorage<SavedDefaults>(DEFAULTS_KEY);
    if (savedDefaults) {
      if (typeof savedDefaults.valorConta === "string") setValorConta(savedDefaults.valorConta);
      if (typeof savedDefaults.taxaCondominioGlobal === "string")
        setTaxaCondominioGlobal(savedDefaults.taxaCondominioGlobal);
      if (typeof savedDefaults.taxaFixa === "string") setTaxaFixa(savedDefaults.taxaFixa);
    }

    const savedState = loadFromStorage<StoredState>(STORAGE_KEY);
    if (savedState) {
      if (Array.isArray(savedState.columns)) setColumns(savedState.columns);
      if (typeof savedState.valorConta === "string") setValorConta(savedState.valorConta);
      if (typeof savedState.taxaCondominioGlobal === "string")
        setTaxaCondominioGlobal(savedState.taxaCondominioGlobal);
      if (typeof savedState.taxaFixa === "string") setTaxaFixa(savedState.taxaFixa);
      if (Array.isArray(savedState.rows) && savedState.rows.length > 0)
        setRows(savedState.rows);
    }

    const savedBackup = loadFromStorage<ReadingsBackup>(BACKUP_KEY);
    if (savedBackup) setBackup(savedBackup);

    hydratedRef.current = true;
  }, []);

  // Salva automaticamente a cada alteração (depois de já ter carregado o que existia).
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveToStorage(STORAGE_KEY, {
      columns,
      valorConta,
      taxaCondominioGlobal,
      taxaFixa,
      rows,
    } satisfies StoredState);
  }, [columns, valorConta, taxaCondominioGlobal, taxaFixa, rows]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (backup) saveToStorage(BACKUP_KEY, backup);
    else removeFromStorage(BACKUP_KEY);
  }, [backup]);

  const valorContaNum = parseMoney(valorConta);
  const taxaFixaNum = parseMoney(taxaFixa);
  // Unidades "que pagam" acompanham a tabela: toda unidade que não está
  // marcada como N/A entra na divisão da taxa fixa.
  const qtdUnidadesPagamNum = Math.max(1, rows.filter((row) => !row.na).length);
  const taxaIndividual = (taxaFixaNum * 2) / qtdUnidadesPagamNum;
  const contaSemTaxaFixa = valorContaNum - taxaIndividual * qtdUnidadesPagamNum;

  const computedRows = useMemo(() => {
    const parsed = rows.map((row) => {
      const isNa = row.na;
      return {
        ...row,
        leituraAnteriorNum: isNa
          ? 0
          : parseFloat(row.leituraAnterior.replace(/,/g, ".")) || 0,
        leituraAtualNum: isNa
          ? 0
          : parseFloat(row.leituraAtual.replace(/,/g, ".")) || 0,
        taxaCondominioNum: parseMoney(row.taxaCondominio || taxaCondominioGlobal),
      };
    });

    const withMedido = parsed.map((row) => ({
      ...row,
      medido: row.na ? 0 : row.leituraAtualNum - row.leituraAnteriorNum,
    }));

    const totalMedido = withMedido.reduce(
      (sum, row) => sum + (row.na ? 0 : row.medido),
      0
    );

    return withMedido.map((row) => {
      let valorAgua = 0;
      if (!row.na) {
        valorAgua =
          totalMedido > 0
            ? (row.medido * contaSemTaxaFixa) / totalMedido + taxaIndividual
            : 0;
      }
      const totalPagar = valorAgua + row.taxaCondominioNum;
      return {
        ...row,
        totalMedido,
        valorAgua,
        totalPagar,
      };
    });
  }, [rows, contaSemTaxaFixa, taxaIndividual, taxaCondominioGlobal]);

  const totals = useMemo(() => {
    const totalMedido = computedRows.reduce(
      (sum, row) => sum + (row.na ? 0 : row.medido),
      0
    );
    const totalValorAgua = computedRows.reduce(
      (sum, row) => sum + (row.na ? 0 : row.valorAgua),
      0
    );
    const totalTaxaCondominio = computedRows.reduce(
      (sum, row) => sum + row.taxaCondominioNum,
      0
    );
    const totalGeral = computedRows.reduce((sum, row) => sum + row.totalPagar, 0);
    return { totalMedido, totalValorAgua, totalTaxaCondominio, totalGeral };
  }, [computedRows]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // Auto-detect N/A rows when both readings are N/A
        const bothNa =
          next.leituraAnterior.trim().toUpperCase() === "N/A" &&
          next.leituraAtual.trim().toUpperCase() === "N/A";
        const bothEmpty =
          next.leituraAnterior.trim() === "" && next.leituraAtual.trim() === "";
        next.na = bothNa || (r.na && bothEmpty);
        return next;
      })
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        unidade: "",
        leituraAnterior: "",
        leituraAtual: "",
        taxaCondominio: taxaCondominioGlobal,
        na: false,
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function avancarMes() {
    const confirmado = window.confirm(
      "Avançar mês vai copiar a Leitura atual para a Leitura anterior em todas as unidades. Deseja continuar?"
    );
    if (!confirmado) return;

    setBackup({
      savedAt: new Date().toISOString(),
      rows: rows.map(({ id, leituraAnterior, leituraAtual, na }) => ({
        id,
        leituraAnterior,
        leituraAtual,
        na,
      })),
    });

    setRows((prev) =>
      prev.map((row) => ({ ...row, leituraAnterior: row.leituraAtual }))
    );
  }

  function voltarMes() {
    if (!backup) return;
    setRows((prev) =>
      prev.map((row) => {
        const saved = backup.rows.find((b) => b.id === row.id);
        if (!saved) return row;
        return {
          ...row,
          leituraAnterior: saved.leituraAnterior,
          leituraAtual: saved.leituraAtual,
          na: saved.na,
        };
      })
    );
    setBackup(null);
  }

  function criarImagemTabela() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const headers = columns.map((col) => col.label);
    const alignRight = [false, false, false, true, true, true, true];

    const dataRows = computedRows.map((row) => [
      row.unidade,
      row.leituraAnterior,
      row.leituraAtual,
      row.na ? "N/A" : formatNumber(row.medido),
      row.na ? "N/A" : formatMoney(row.valorAgua),
      row.taxaCondominio,
      formatMoney(row.totalPagar),
    ]);

    const totalRow = [
      "TOTAL",
      "",
      "",
      formatNumber(totals.totalMedido),
      formatMoney(totals.totalValorAgua),
      formatMoney(totals.totalTaxaCondominio),
      formatMoney(totals.totalGeral),
    ];

    const allRows = [headers, ...dataRows, totalRow];

    const padX = 14;
    const rowHeight = 32;
    const titleHeight = 48;
    const headerFont = "bold 13px system-ui, -apple-system, sans-serif";
    const cellFont = "13px system-ui, -apple-system, sans-serif";

    ctx.font = headerFont;
    const colWidths = headers.map((_, colIndex) => {
      let max = 0;
      for (const row of allRows) {
        max = Math.max(max, ctx.measureText(row[colIndex] ?? "").width);
      }
      return Math.ceil(max) + padX * 2;
    });

    const width = colWidths.reduce((a, b) => a + b, 0);
    const height = titleHeight + rowHeight * (dataRows.length + 2);
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("Cálculo Rateio Qe 40", padX, titleHeight / 2 + 6);

    const rowStyles = [
      { bg: "#dbeafe", font: headerFont, color: "#1e3a8a" },
      ...dataRows.map(() => ({ bg: "#ffffff", font: cellFont, color: "#111827" })),
      { bg: "#bfdbfe", font: headerFont, color: "#1e3a8a" },
    ];

    let y = titleHeight;
    allRows.forEach((row, rowIndex) => {
      const style = rowStyles[rowIndex];
      if (!style) return;

      ctx.fillStyle = style.bg;
      ctx.fillRect(0, y, width, rowHeight);

      let x = 0;
      row.forEach((value, colIndex) => {
        const colWidth = colWidths[colIndex] ?? 0;
        ctx.font = style.font;
        ctx.fillStyle = style.color;
        ctx.textBaseline = "middle";
        if (alignRight[colIndex]) {
          ctx.textAlign = "right";
          ctx.fillText(value, x + colWidth - padX, y + rowHeight / 2);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(value, x + padX, y + rowHeight / 2);
        }
        x += colWidth;
      });

      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(width, y + rowHeight);
      ctx.stroke();

      y += rowHeight;
    });

    let x = 0;
    ctx.strokeStyle = "#e2e8f0";
    for (const colWidth of colWidths) {
      ctx.beginPath();
      ctx.moveTo(x, titleHeight);
      ctx.lineTo(x, height);
      ctx.stroke();
      x += colWidth;
    }
    ctx.beginPath();
    ctx.moveTo(width, titleHeight);
    ctx.lineTo(width, height);
    ctx.stroke();

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `rateio-qe40-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();

    saveToStorage(DEFAULTS_KEY, {
      valorConta,
      taxaCondominioGlobal,
      taxaFixa,
    } satisfies SavedDefaults);
  }

  // Atualiza o padrão global de taxa de condomínio e propaga para toda linha
  // que ainda estava acompanhando o valor antigo (preserva exceções manuais,
  // como a Loja com "N/A").
  function handleTaxaCondominioGlobalChange(rawValue: string) {
    const masked = maskCurrencyInput(rawValue);
    setRows((prev) =>
      prev.map((row) =>
        row.taxaCondominio === taxaCondominioGlobal
          ? { ...row, taxaCondominio: masked }
          : row
      )
    );
    setTaxaCondominioGlobal(masked);
  }

  function updateColumnLabel(id: string, label: string) {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, label } : col))
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1 rounded-xl bg-gradient-to-r from-primary to-sky-500 px-6 py-8 text-center text-primary-foreground shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Cálculo Rateio Qe 40
          </h1>
          <p className="text-sm text-primary-foreground/80">
            Preencha os dados e os valores são calculados automaticamente.
          </p>
        </header>

        <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="valorConta" className="text-sm font-medium">
              Valor da conta
            </label>
            <input
              id="valorConta"
              type="text"
              inputMode="numeric"
              value={valorConta}
              onChange={(e) => setValorConta(maskCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="taxaCondominio" className="text-sm font-medium">
              Taxa de condomínio
            </label>
            <input
              id="taxaCondominio"
              type="text"
              inputMode="numeric"
              value={taxaCondominioGlobal}
              onChange={(e) => handleTaxaCondominioGlobalChange(e.target.value)}
              placeholder="R$ 0,00"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="taxaFixa" className="text-sm font-medium">
              Taxa fixa
            </label>
            <input
              id="taxaFixa"
              type="text"
              inputMode="numeric"
              value={taxaFixa}
              onChange={(e) => setTaxaFixa(maskCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="qtdUnidades" className="text-sm font-medium">
              Quantidade de unidades que pagam
            </label>
            <input
              id="qtdUnidades"
              type="text"
              readOnly
              value={qtdUnidadesPagamNum}
              title="Calculado automaticamente: total de unidades que não estão marcadas como N/A"
              className="w-full cursor-not-allowed rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground outline-none"
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Unidades</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={voltarMes}
                disabled={!backup}
                title={
                  backup
                    ? `Desfazer o avanço de mês de ${new Date(backup.savedAt).toLocaleString("pt-BR")}`
                    : "Nenhum avanço de mês para desfazer"
                }
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
              >
                ↺ Voltar mês
              </button>
              <button
                type="button"
                onClick={avancarMes}
                title="Copia a Leitura atual de cada unidade para a Leitura anterior"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Avançar mês →
              </button>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                + Adicionar unidade
              </button>
              <button
                type="button"
                onClick={criarImagemTabela}
                title="Baixa uma imagem PNG da tabela com os dados preenchidos"
                className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                Criar imagem ⬇
              </button>
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            As leituras e os campos preenchidos são salvos automaticamente neste navegador.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10">
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="border px-2 py-2 text-left font-semibold"
                    >
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          updateColumnLabel(col.id, e.currentTarget.textContent || "")
                        }
                        className="min-w-[80px] outline-none"
                      >
                        {col.label}
                      </div>
                    </th>
                  ))}
                  <th className="border px-2 py-2 text-left font-semibold w-16">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {computedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="border px-1 py-1">
                      <input
                        type="text"
                        value={row.unidade}
                        onChange={(e) =>
                          updateRow(row.id, { unidade: e.target.value })
                        }
                        onPaste={(e) => {
                          const parts = splitPastedValues(
                            e.clipboardData.getData("text")
                          );
                          if (parts.length < 2) return;
                          e.preventDefault();
                          updateRow(row.id, {
                            unidade: parts[0] ?? "",
                            leituraAnterior: parts[1] ?? "",
                          });
                        }}
                        className="w-full bg-transparent px-2 py-1 outline-none"
                        placeholder="Unidade"
                      />
                    </td>
                    <td className="border px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.leituraAnterior}
                        onChange={(e) =>
                          updateRow(row.id, { leituraAnterior: e.target.value })
                        }
                        onPaste={(e) => {
                          const parts = splitPastedValues(
                            e.clipboardData.getData("text")
                          );
                          if (parts.length < 2) return;
                          e.preventDefault();
                          updateRow(row.id, {
                            leituraAnterior: parts[0] ?? "",
                            leituraAtual: parts[1] ?? "",
                          });
                        }}
                        className="w-full bg-transparent px-2 py-1 outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="border px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.leituraAtual}
                        onChange={(e) =>
                          updateRow(row.id, { leituraAtual: e.target.value })
                        }
                        className="w-full bg-transparent px-2 py-1 outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="border px-2 py-1 text-right tabular-nums">
                      {row.na ? "N/A" : formatNumber(row.medido)}
                    </td>
                    <td className="border px-2 py-1 text-right tabular-nums">
                      {row.na ? "N/A" : formatMoney(row.valorAgua)}
                    </td>
                    <td className="border px-1 py-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.taxaCondominio}
                        onChange={(e) =>
                          updateRow(row.id, { taxaCondominio: e.target.value })
                        }
                        onBlur={(e) =>
                          updateRow(row.id, {
                            taxaCondominio: formatMoney(parseMoney(e.target.value)),
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 outline-none text-right tabular-nums"
                        placeholder="R$ 0,00"
                      />
                    </td>
                    <td className="border px-2 py-1 text-right font-semibold tabular-nums">
                      {formatMoney(row.totalPagar)}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-destructive hover:text-destructive/80"
                        aria-label="Remover linha"
                        title="Remover linha"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {computedRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="border px-4 py-8 text-center text-muted-foreground"
                    >
                      Nenhuma unidade adicionada. Clique em "Adicionar unidade"
                      para começar.
                    </td>
                  </tr>
                )}
                <tr className="bg-primary/15 font-semibold">
                  <td className="border px-2 py-2">TOTAL</td>
                  <td className="border px-2 py-2"></td>
                  <td className="border px-2 py-2"></td>
                  <td className="border px-2 py-2 text-right tabular-nums">
                    {formatNumber(totals.totalMedido)}
                  </td>
                  <td className="border px-2 py-2 text-right tabular-nums">
                    {formatMoney(totals.totalValorAgua)}
                  </td>
                  <td className="border px-2 py-2 text-right tabular-nums">
                    {formatMoney(totals.totalTaxaCondominio)}
                  </td>
                  <td className="border px-2 py-2 text-right tabular-nums">
                    {formatMoney(totals.totalGeral)}
                  </td>
                  <td className="border px-2 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-2 text-base font-semibold">Legenda dos relógios</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> sem rótulo → 302
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> invertido sem
                rótulo → 601
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> loja → 01
              </li>
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-2 text-base font-semibold">Resumo do cálculo</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa individual:</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(taxaIndividual)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conta sem taxa fixa:</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(contaSemTaxaFixa)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="font-semibold text-emerald-900">CONTA DE ÁGUA</span>
                <span className="font-bold tabular-nums text-emerald-700">
                  {formatMoney(totals.totalValorAgua)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          OBS: a CAESB cobra uma taxa fixa por apartamento, mesmo que não tenha
          consumo de água.
        </p>
      </div>
    </div>
  );
}
