import { supabase } from "@/lib/supabase";

export type Row = {
  id: string;
  unidade: string;
  leituraAnterior: string;
  leituraAtual: string;
  taxaCondominio: string;
  na: boolean;
};

export type Column = {
  id: string;
  label: string;
};

export type Settings = {
  columns: Column[];
  valorConta: string;
  taxaCondominioGlobal: string;
  taxaFixa: string;
  mesReferencia: string;
};

export type HistoricoTotals = {
  totalMedido: number;
  totalValorAgua: number;
  totalTaxaCondominio: number;
  totalGeral: number;
};

export type HistoricoEntry = {
  mesReferencia: string;
  savedAt: string;
  rows: Row[];
  totals: HistoricoTotals | null;
};

const SETTINGS_ID = "default";

export async function fetchState(): Promise<{ settings: Settings; rows: Row[] } | null> {
  const [settingsRes, rowsRes] = await Promise.all([
    supabase.from("rateio_settings").select("*").eq("id", SETTINGS_ID).maybeSingle(),
    supabase.from("rateio_rows").select("*").order("position", { ascending: true }),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (rowsRes.error) throw rowsRes.error;
  if (!settingsRes.data) return null;

  const settings: Settings = {
    columns: settingsRes.data.columns,
    valorConta: settingsRes.data.valor_conta,
    taxaCondominioGlobal: settingsRes.data.taxa_condominio_global,
    taxaFixa: settingsRes.data.taxa_fixa,
    mesReferencia: settingsRes.data.mes_referencia,
  };

  const rows: Row[] = (rowsRes.data ?? []).map((r) => ({
    id: r.id,
    unidade: r.unidade,
    leituraAnterior: r.leitura_anterior,
    leituraAtual: r.leitura_atual,
    taxaCondominio: r.taxa_condominio,
    na: r.na,
  }));

  return { settings, rows };
}

export async function saveState(settings: Settings, rows: Row[]): Promise<void> {
  const { data: existingRows, error: existingError } = await supabase
    .from("rateio_rows")
    .select("id");
  if (existingError) throw existingError;

  const currentIds = new Set(rows.map((r) => r.id));
  const idsToDelete = (existingRows ?? [])
    .map((r) => r.id as string)
    .filter((id) => !currentIds.has(id));

  const operations: PromiseLike<{ error: unknown }>[] = [
    supabase.from("rateio_settings").upsert({
      id: SETTINGS_ID,
      columns: settings.columns,
      valor_conta: settings.valorConta,
      taxa_condominio_global: settings.taxaCondominioGlobal,
      taxa_fixa: settings.taxaFixa,
      mes_referencia: settings.mesReferencia,
      updated_at: new Date().toISOString(),
    }),
  ];

  if (rows.length > 0) {
    operations.push(
      supabase.from("rateio_rows").upsert(
        rows.map((row, index) => ({
          id: row.id,
          unidade: row.unidade,
          leitura_anterior: row.leituraAnterior,
          leitura_atual: row.leituraAtual,
          taxa_condominio: row.taxaCondominio,
          na: row.na,
          position: index,
          updated_at: new Date().toISOString(),
        }))
      )
    );
  }

  if (idsToDelete.length > 0) {
    operations.push(supabase.from("rateio_rows").delete().in("id", idsToDelete));
  }

  const results = await Promise.all(operations);
  for (const { error } of results) if (error) throw error;
}

export async function saveHistorico(entry: {
  mesReferencia: string;
  rows: Row[];
  totals: HistoricoTotals;
}): Promise<void> {
  const { error } = await supabase.from("rateio_historico").upsert({
    mes_referencia: entry.mesReferencia,
    saved_at: new Date().toISOString(),
    rows: entry.rows,
    totals: entry.totals,
  });
  if (error) throw error;
}

export async function fetchHistorico(mesReferencia: string): Promise<HistoricoEntry | null> {
  const { data, error } = await supabase
    .from("rateio_historico")
    .select("*")
    .eq("mes_referencia", mesReferencia)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    mesReferencia: data.mes_referencia,
    savedAt: data.saved_at,
    rows: data.rows as Row[],
    totals: (data.totals as HistoricoTotals) ?? null,
  };
}

export async function deleteHistorico(mesReferencia: string): Promise<void> {
  const { error } = await supabase
    .from("rateio_historico")
    .delete()
    .eq("mes_referencia", mesReferencia);
  if (error) throw error;
}
