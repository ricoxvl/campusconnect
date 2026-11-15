import { useState } from "react";
import { apiRequest } from "../services/eventRepository";
import type { ImportRow } from "../../worker/csv";
export function AdminImport({
  token,
  onReview,
}: {
  token?: string;
  onReview: () => void;
}) {
  const [csv, setCsv] = useState(""),
    [rows, setRows] = useState<ImportRow[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function preview() {
    setBusy(true);
    setError("");
    setMessage("");
    setRows([]);
    try {
      const result = await apiRequest<{ data: ImportRow[] }>(
        "/admin/import/preview",
        { method: "POST", body: JSON.stringify({ csv }) },
        token,
      );
      setRows(result.data);
      setSelected(
        result.data.filter((row) => !row.errors.length).map((row) => row.row),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const results: { status: string; row: number; message: string }[] = [];
      for (let offset = 0; offset < selected.length; offset += 5) {
        const result = await apiRequest<{
          data: { status: string; row: number; message: string }[];
        }>(
          "/admin/import",
          {
            method: "POST",
            body: JSON.stringify({
              csv,
              rows: selected.slice(offset, offset + 5),
            }),
          },
          token,
        );
        results.push(...result.data);
        setMessage(
          `${results.filter((row) => row.status === "created").length} drafts created so far. Nothing has been published.`,
        );
      }
      const created = results.filter((row) => row.status === "created").length;
      setMessage(
        `${created} event${created === 1 ? "" : "s"} imported as unverified drafts. ${results.length - created} conflict${results.length - created === 1 ? "" : "s"}. Nothing was published. Review each official source before verification.`,
      );
      setRows([]);
      setSelected([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-section">
      <h2>CSV event import</h2>
      <p className="small muted mt-2">
        Preview up to 50 events (60 KB of CSV). Only selected valid records
        become drafts. Verification and publication claims from a file are never
        accepted.
      </p>
      <a
        className="text-link underlined"
        href="/event-import-template.csv"
        download
      >
        Download CSV template
      </a>
      <p className="small muted">
        Use category and organizer IDs from their management tabs. Separate
        multiple interest IDs with |.
      </p>
      <label className="upload-label">
        Choose CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setRows([]);
            setMessage("");
            setError("");
            if (!file) return;
            if (file.size > 60000) {
              setCsv("");
              setSelected([]);
              setError("Choose a CSV file no larger than 60 KB.");
              return;
            }
            setCsv(await file.text());
          }}
        />
      </label>
      <label className="csv-input-label">
        CSV contents
        <textarea
          disabled={busy}
          value={csv}
          spellCheck={false}
          onChange={(e) => {
            setCsv(e.target.value);
            setRows([]);
            setSelected([]);
            setMessage("");
          }}
        />
      </label>
      <button
        className="button secondary mt-3"
        disabled={busy || !csv.trim()}
        onClick={preview}
      >
        {busy ? "Checking…" : "Preview import"}
      </button>
      {error && (
        <p role="alert" className="validation">
          {error}
        </p>
      )}
      {message && (
        <div className="note mt-4">
          <p role="status">{message}</p>
          <button className="text-link" onClick={onReview}>
            Review imported drafts →
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <>
          <p role="status" className="small mt-4">
            {rows.filter((row) => !row.errors.length).length} ready to import;{" "}
            {rows.filter((row) => row.errors.length).length} need correction.
          </p>
          <div className="admin-list">
            {rows.map((row) => (
              <article className="note" key={row.row}>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    disabled={row.errors.length > 0 || busy}
                    checked={selected.includes(row.row)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(row.row)
                          ? current.filter((n) => n !== row.row)
                          : [...current, row.row],
                      )
                    }
                  />
                  Record {row.row}: {row.title || "Untitled"}
                </label>
                <p className="small muted">
                  {row.input?.startsAt} · {row.input?.location}
                </p>
                {row.errors.map((error, index) => (
                  <p className="import-error" key={index}>
                    {error}
                  </p>
                ))}
                {row.duplicateOf && (
                  <p className="small">
                    Existing event: {row.duplicateOf.title} (
                    {row.duplicateOf.status})
                  </p>
                )}
                {!row.errors.length && (
                  <p className="small muted">Ready as an unverified draft.</p>
                )}
              </article>
            ))}
          </div>
          <button
            className="button primary mt-4"
            disabled={busy || !selected.length}
            onClick={commit}
          >
            {busy
              ? "Importing…"
              : `Import ${selected.length} selected draft${selected.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </section>
  );
}
