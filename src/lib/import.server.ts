import { admin, logAudit } from "./db.server";
import { isValidSolanaAddress } from "./solana.server";

export type ImportRow = {
  mint: string;
  symbol: string | null;
  callerTelegramId: number;
  baselinePriceUsd: number;
  peakPriceUsd: number | null;
  calledAt: string | null;
  note: string | null;
};

export type ParsedImport = {
  rows: ImportRow[];
  errors: { line: number; reason: string }[];
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

const REQUIRED = ["mint", "caller_telegram_id", "baseline_price_usd"];

/**
 * Pure CSV parser for historical calls. Header-driven so column order does not
 * matter; every rejected line is reported rather than silently dropped.
 */
export function parseCallsCsv(csv: string): ParsedImport {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { rows: [], errors: [{ line: 0, reason: "empty_file" }] };

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, reason: `missing_columns:${missing.join("|")}` }] };
  }

  const index = (name: string) => header.indexOf(name);
  const rows: ImportRow[] = [];
  const errors: { line: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const value = (name: string) => {
      const at = index(name);
      return at >= 0 ? (cells[at] ?? "") : "";
    };

    const mint = value("mint");
    const callerTelegramId = Number(value("caller_telegram_id"));
    const baselinePriceUsd = Number(value("baseline_price_usd"));
    const peakRaw = value("peak_price_usd");
    const peakPriceUsd = peakRaw ? Number(peakRaw) : null;
    const calledAtRaw = value("called_at");

    if (!isValidSolanaAddress(mint)) {
      errors.push({ line: i + 1, reason: "invalid_mint" });
      continue;
    }
    if (!Number.isFinite(callerTelegramId) || callerTelegramId <= 0) {
      errors.push({ line: i + 1, reason: "invalid_caller" });
      continue;
    }
    if (!Number.isFinite(baselinePriceUsd) || baselinePriceUsd <= 0) {
      errors.push({ line: i + 1, reason: "invalid_baseline_price" });
      continue;
    }
    if (peakPriceUsd !== null && (!Number.isFinite(peakPriceUsd) || peakPriceUsd <= 0)) {
      errors.push({ line: i + 1, reason: "invalid_peak_price" });
      continue;
    }
    let calledAt: string | null = null;
    if (calledAtRaw) {
      const parsed = new Date(calledAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ line: i + 1, reason: "invalid_called_at" });
        continue;
      }
      calledAt = parsed.toISOString();
    }

    rows.push({
      mint,
      symbol: value("symbol") || null,
      callerTelegramId,
      baselinePriceUsd,
      peakPriceUsd,
      calledAt,
      note: value("note") || null,
    });
  }

  return { rows, errors };
}

/**
 * Writes parsed rows as `imported` calls. Imported history is displayed but
 * never scored, so a group cannot inflate its own BRUH Score by upload.
 */
export async function importHistoricalCalls(input: {
  groupId: string;
  actorMembershipId: string;
  csv: string;
}): Promise<{ inserted: number; skipped: { line: number; reason: string }[] }> {
  const parsed = parseCallsCsv(input.csv);
  const db = await admin();

  const { data: members } = await db
    .from("group_members")
    .select("id, telegram_user_id")
    .eq("group_id", input.groupId);

  const byTelegramId = new Map<number, string>();
  for (const member of members ?? []) {
    byTelegramId.set(Number(member.telegram_user_id), member.id);
  }

  const skipped = [...parsed.errors];
  const payload: Record<string, unknown>[] = [];

  parsed.rows.forEach((row, offset) => {
    const membershipId = byTelegramId.get(row.callerTelegramId);
    if (!membershipId) {
      skipped.push({ line: offset + 2, reason: "caller_not_in_group" });
      return;
    }
    payload.push({
      group_id: input.groupId,
      caller_membership_id: membershipId,
      mint: row.mint,
      symbol: row.symbol,
      status: "imported",
      source: "import",
      note: row.note,
      baseline_price_usd: row.baselinePriceUsd,
      ath_price_usd: row.peakPriceUsd,
      ath_multiple: row.peakPriceUsd ? row.peakPriceUsd / row.baselinePriceUsd : null,
      ...(row.calledAt ? { created_at: row.calledAt, source_seen_at: row.calledAt } : {}),
    });
  });

  if (payload.length > 0) {
    const { error } = await db.from("calls").insert(payload);
    if (error) throw error;
  }

  await logAudit({
    groupId: input.groupId,
    actorType: "moderator",
    actorId: input.actorMembershipId,
    eventType: "calls_imported",
    entityType: "call",
    afterState: { inserted: payload.length, skipped: skipped.length },
  });

  return { inserted: payload.length, skipped };
}
