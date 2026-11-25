// The server logs these around pending migrations; the desktop reads them from its output tail,
// which keeps only the last few thousand characters, so each progress line also marks a running upgrade.
import type { DatabaseMigrationProgress } from "@t3tools/contracts";

export const DATABASE_MIGRATIONS_STARTED_MESSAGE = "Running database migrations";
export const DATABASE_MIGRATION_PROGRESS_MESSAGE = "Upgrading database";
export const DATABASE_MIGRATIONS_FINISHED_MESSAGE = "Migrations ran successfully";

export function isRunningDatabaseMigrations(output: string): boolean {
  return (
    Math.max(
      output.lastIndexOf(DATABASE_MIGRATIONS_STARTED_MESSAGE),
      output.lastIndexOf(DATABASE_MIGRATION_PROGRESS_MESSAGE),
    ) > output.lastIndexOf(DATABASE_MIGRATIONS_FINISHED_MESSAGE)
  );
}

export function databaseMigrationProgress(
  output: string,
  previous: DatabaseMigrationProgress | null = null,
): DatabaseMigrationProgress | null {
  if (!isRunningDatabaseMigrations(output)) {
    return output.includes(DATABASE_MIGRATIONS_FINISHED_MESSAGE) ? null : previous;
  }
  const start = output.lastIndexOf(DATABASE_MIGRATIONS_STARTED_MESSAGE);
  const step = output.lastIndexOf(DATABASE_MIGRATION_PROGRESS_MESSAGE);
  if (step < start) return null;
  const end = output.indexOf("\n", step);
  const line = output.slice(step, end === -1 ? undefined : end);
  const match =
    /^Upgrading database \((\d+) of (\d+)\)/.exec(line) ??
    /(?:progress=|"progress"\s*:\s*)"(\d+) of (\d+)"/.exec(line);
  if (!match) return previous;
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(total)) return previous;
  if (current <= 0 || current > total) return previous;
  const migration = migrationName(output.slice(step, step + MIGRATION_NAME_WINDOW));
  return migration ? { current, total, migration } : { current, total };
}

// Pretty, logfmt and JSON loggers all print the `migration` annotation shortly after the message.
const MIGRATION_NAME_WINDOW = 400;

function migrationName(block: string): string | undefined {
  const next = block.indexOf(DATABASE_MIGRATION_PROGRESS_MESSAGE, 1);
  const scope = next === -1 ? block : block.slice(0, next);
  return /(?:^|\s|")migration"?\s*[:=]\s*"?(\d+_\w+)/.exec(scope)?.[1];
}
