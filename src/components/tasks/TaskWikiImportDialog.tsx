"use client";

import { useRef, useState, type RefObject } from "react";
import { parseWikiTaskPage } from "@/tasks/progress";
import type { TaskRecord } from "@/tasks";

const MAX_WIKI_HTML_BYTES = 25 * 1024 * 1024;

export function TaskWikiImportDialog({
  dialogRef,
  tasksWikiUrl,
  records,
  onImportWikiTasks,
  notice,
  setNotice,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  tasksWikiUrl: string;
  records: readonly TaskRecord[];
  onImportWikiTasks: (completedWikiTaskIds: number[]) => { added: number; matched: number };
  notice: string;
  setNotice: (value: string) => void;
}) {
  const wikiHtmlInput = useRef<HTMLInputElement>(null);
  const [wikiHtmlFile, setWikiHtmlFile] = useState<File | null>(null);

  const importWikiHtml = async (file: File) => {
    if (file.size > MAX_WIKI_HTML_BYTES) {
      setNotice("That HTML file is too large.");
      return;
    }

    try {
      const parsed = parseWikiTaskPage(await file.text());
      if (parsed.taskRows === 0) {
        setNotice("That file is not a saved Wiki task page.");
        return;
      }
      if (parsed.completedTaskIds.length === 0) {
        setNotice("No WikiSync completions found. Run the lookup before saving.");
        return;
      }

      const knownWikiIds = new Set(
        records.flatMap((record) =>
          typeof record.wikiTaskId === "number" ? [record.wikiTaskId] : [],
        ),
      );
      const matched = parsed.completedTaskIds.filter((id) => knownWikiIds.has(id)).length;
      if (matched === 0) {
        setNotice("No tasks in that file match this task list.");
        return;
      }

      const imported = onImportWikiTasks(parsed.completedTaskIds);
      setNotice(
        imported.added > 0
          ? `${imported.added.toLocaleString("en-US")} ${imported.added === 1 ? "task" : "tasks"} imported · ${imported.matched.toLocaleString("en-US")} matched.`
          : `All ${imported.matched.toLocaleString("en-US")} matched tasks were already complete.`,
      );
    } catch {
      setNotice("Could not read that HTML file.");
    }
  };

  return (
    <dialog ref={dialogRef} className="tasks-import-dialog" aria-labelledby="tasks-import-title">
      <header className="tasks-import-dialog__header">
        <h2 id="tasks-import-title">Import Wiki progress</h2>
        <button
          type="button"
          className="tasks-import-dialog__close"
          aria-label="Close import window"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </header>
      <div className="tasks-import-dialog__body">
        <ol>
          <li>
            Open the{" "}
            <a href={tasksWikiUrl} target="_blank" rel="noreferrer">
              Wiki task page
            </a>
            .
          </li>
          <li>Enter your RuneScape name in WikiSync and choose Look up.</li>
          <li>Wait for your completed tasks to turn green.</li>
          <li>Press Ctrl+S (⌘S on Mac) and save the page as an .html file.</li>
          <li>Browse for that file below, then choose Upload.</li>
        </ol>
        <p>
          Processed locally. Not uploaded.{" "}
          <a href="https://runescape.wiki/w/RuneScape:WikiSync" target="_blank" rel="noreferrer">
            RuneScape Wiki: “publicly available to anyone”
          </a>
        </p>
        {notice ? (
          <p className="tasks-import-dialog__notice" role="status">
            {notice}
          </p>
        ) : null}
      </div>
      <footer className="tasks-import-dialog__actions">
        <input
          ref={wikiHtmlInput}
          hidden
          type="file"
          accept=".html,.htm,text/html"
          aria-label="Choose saved Wiki page"
          onChange={(event) => {
            const input = event.currentTarget;
            setWikiHtmlFile(input.files?.[0] ?? null);
            setNotice("");
            input.value = "";
          }}
        />
        <button
          type="button"
          className="tasks-import-dialog__browse"
          onClick={() => wikiHtmlInput.current?.click()}
        >
          Browse
        </button>
        <span className="tasks-import-dialog__file">
          {wikiHtmlFile?.name ?? "No file selected"}
        </span>
        <button
          type="button"
          className="tasks-import-dialog__upload"
          disabled={!wikiHtmlFile}
          onClick={() => {
            if (wikiHtmlFile) void importWikiHtml(wikiHtmlFile);
          }}
        >
          Upload
        </button>
      </footer>
    </dialog>
  );
}
