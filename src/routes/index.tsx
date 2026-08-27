import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

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

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function generateDefaultRows(taxaCondominioGlobal: string): Row[] {
  const units: string[] = [];
  for (let floor = 1; floor <= 6; floor++) {
    for (let unit = 1; unit <= 4; unit++) {
      units.push(`${floor}0${unit}`);
    }
  }
  units.push("Loja");

  return units.map((unidade) => ({
    id: uid(),
    unidade,
    leituraAnterior: "",
    leituraAtual: "",
    taxaCondominio: taxaCondominioGlobal,
    na: false,
  }));
}

function Index() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  const [valorConta, setValorConta] = useState<string>("R$ 1.683,44");
  const [taxaCondominioGlobal, setTaxaCondominioGlobal] = useState<string>("R$ 30,00");
  const [taxaFixa, setTaxaFixa] = useState<string>("R$ 22,18");
  const [qtdUnidadesPagam, setQtdUnidadesPagam] = useState<string>("22");

  const [rows, setRows] = useState<Row[]>(() => generateDefaultRows(taxaCondominioGlobal));

  const valorContaNum = parseMoney(valorConta);
  const taxaFixaNum = parseMoney(taxaFixa);
  const qtdUnidadesPagamNum = Math.max(1, parseInt(qtdUnidadesPagam, 10) || 1);
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

  function updateColumnLabel(id: string, label: string) {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, label } : col))
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Cálculo Rateio Qe 40
          </h1>
          <p className="text-sm text-muted-foreground">
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
              inputMode="decimal"
              value={valorConta}
              onChange={(e) => setValorConta(e.target.value)}
              onBlur={(e) => setValorConta(formatMoney(parseMoney(e.target.value)))}
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
              inputMode="decimal"
              value={taxaCondominioGlobal}
              onChange={(e) => setTaxaCondominioGlobal(e.target.value)}
              onBlur={(e) =>
                setTaxaCondominioGlobal(formatMoney(parseMoney(e.target.value)))
              }
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
              inputMode="decimal"
              value={taxaFixa}
              onChange={(e) => setTaxaFixa(e.target.value)}
              onBlur={(e) => setTaxaFixa(formatMoney(parseMoney(e.target.value)))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="qtdUnidades" className="text-sm font-medium">
              Quantidade de unidades que pagam
            </label>
            <input
              id="qtdUnidades"
              type="number"
              min={1}
              value={qtdUnidadesPagam}
              onChange={(e) => setQtdUnidadesPagam(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Unidades</h2>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              + Adicionar unidade
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
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
                <tr className="bg-muted/50 font-semibold">
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
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>sem rótulo → 302</li>
              <li>invertido sem rótulo → 601</li>
              <li>loja → 01</li>
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
              <div className="flex justify-between border-t pt-1">
                <span className="font-semibold">CONTA DE ÁGUA</span>
                <span className="font-bold tabular-nums">
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
