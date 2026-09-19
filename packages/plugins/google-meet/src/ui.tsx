/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import { ArrowRight01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import type * as UI from "@nakama/ui";
import type * as ReactType from "react";
import type { Meeting } from "./store";
import type { TranscriptSegment } from "./transcription";

type Context = {
  React: typeof ReactType;
  ui: typeof UI;
  signal: AbortSignal;
  slots: { register(slot: "page", component: ReactType.ComponentType): void };
  styles(css: string): void;
  host: { call(action: string, input?: unknown): Promise<unknown> };
};
type Overview = {
  meetings: Meeting[];
  configured: boolean;
  canConfigure: boolean;
  worker: { state: string; message?: string; captureUrl?: string };
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";
export const inject = ["slots", "host", "styles", "ui"];

function meetingStatus(meeting: Meeting) {
  if (["queued", "joining", "transcribing"].includes(meeting.state)) {
    return meeting.stopRequested
      ? "Stopping…"
      : meeting.state === "transcribing"
        ? "Transcribing…"
        : "Connecting…";
  }
  if (meeting.state === "failed") {
    return meeting.transcriptFile
      ? "Partial transcript"
      : "Transcription failed";
  }
  return meeting.transcriptFile ? "Transcript ready" : "No speech captured";
}

export function apply(ctx: Context) {
  const React = ctx.React;
  const {
    Button,
    Card,
    Input,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    ConfirmDialog,
  } = ctx.ui;
  ctx.styles(
    `
    .meet-page{display:grid;gap:32px;max-width:768px;width:100%;min-width:0;margin:0 auto;font-size:14px}
    .meet-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
    .meet-card{box-shadow:none;overflow:hidden}
    .meet-card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)}
    .meet-page h2,.meet-page h3{font-size:14px;font-weight:500;margin:0}
    .meet-form{display:grid;gap:12px}
    .meet-form label{display:grid;gap:6px;font-size:14px;font-weight:500;min-width:0}
    .meet-list{list-style:none;padding:0;margin:0}
    .meet-list li{position:relative;padding:10px 16px;display:grid;gap:6px}
    .meet-list li:hover{background:color-mix(in oklab,var(--muted) 50%,transparent)}
    .meet-open::after{content:"";position:absolute;inset:0;cursor:pointer}
    .meet-open:focus-visible::after{outline:2px solid var(--ring);outline-offset:-2px}
    .meet-meeting .meet-row>.meet-open{position:static;scale:none;transform:none}
    .meet-action{position:relative;z-index:1}
    .meet-delete:hover{color:var(--destructive)}
    .meet-list li+li{border-top:1px solid var(--border)}
    .meet-meeting{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
    .meet-meta{display:grid;gap:4px;min-width:0;flex:1 1 220px}
    .meet-link{overflow-wrap:anywhere}
    .meet-meeting .meet-row>button{min-height:40px}
    .meet-link:hover{text-decoration:underline}
    .meet-status{font-size:12px;color:var(--muted-foreground);overflow-wrap:anywhere}
    .meet-badge{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:12px;color:var(--muted-foreground)}
    .meet-empty{padding:32px 16px;text-align:center;color:var(--muted-foreground);font-size:14px}
    .meet-page [role=alert]{font-size:14px;color:var(--destructive);overflow-wrap:anywhere}
    .meet-detail{display:grid;gap:16px;min-width:0}
    .meet-detail-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .meet-detail h2{font-size:20px;font-weight:600;letter-spacing:-0.02em}
    .meet-document{padding:24px;min-width:0}
    .meet-document-text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:15px;line-height:1.9}
    .meet-detail .meet-row>button{min-height:40px}
    @media(max-width:480px){.meet-document{padding:16px}}
    `
  );

  function Settings({ close }: { close(): void }) {
    const [apiKey, setApiKey] = React.useState("");
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    async function save(event: ReactType.FormEvent) {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        await ctx.host.call("configure", {
          apiKey: apiKey || undefined,
        });
        setApiKey("");
        close();
      } catch (reason) {
        setError(message(reason));
      } finally {
        setBusy(false);
      }
    }
    return (
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        open
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Meet settings</DialogTitle>
          </DialogHeader>
          <form className="meet-form" onSubmit={save}>
            <label>
              OpenAI API key
              <Input
                autoComplete="off"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Keep saved key"
                type="password"
                value={apiKey}
              />
            </label>
            <p className="meet-status">
              gpt-transcribe uses separate API billing. Your ChatGPT
              subscription does not cover transcription.
            </p>
            <p className="meet-status">
              Open the Nakama Chrome extension on this page and connect it. Then
              start transcription from the extension in your Meet tab.
            </p>
            {error && <p role="alert">{error}</p>}
            <Button disabled={busy} type="submit">
              {busy ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  function Transcript({ meeting, close }: { meeting: Meeting; close(): void }) {
    const [text, setText] = React.useState("");
    const [error, setError] = React.useState("");
    const [loaded, setLoaded] = React.useState(false);
    const [copyStatus, setCopyStatus] = React.useState("");
    const heading = React.useRef<HTMLHeadingElement>(null);
    React.useEffect(() => heading.current?.focus(), []);
    React.useEffect(() => {
      let alive = true;
      let cursor = 0;
      let running = false;
      async function refresh() {
        if (!alive || running || ctx.signal.aborted) {
          return;
        }
        running = true;
        try {
          const value = (await ctx.host.call("transcript", {
            after: cursor,
            meetingId: meeting.id,
          })) as {
            segments: (TranscriptSegment & { sequence: number })[];
            nextCursor: number;
          };
          if (alive && !ctx.signal.aborted) {
            cursor = value.nextCursor;
            setText(
              (previous) =>
                previous +
                value.segments.map((segment) => segment.text + "\n").join("")
            );
            setError("");
            setLoaded(true);
          }
        } catch (reason) {
          if (alive) {
            setError(message(reason));
          }
        } finally {
          running = false;
        }
      }
      void refresh();
      const timer = setInterval(() => void refresh(), 2000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [meeting.id]);
    function download() {
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `meeting-${new Date(meeting.createdAt).toISOString().slice(0, 10)}-${meeting.url.split("/").pop()}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return (
      <section className="meet-detail">
        <div>
          <Button onClick={close} size="sm" variant="ghost">
            ← Back to meetings
          </Button>
        </div>
        <div className="meet-detail-heading">
          <div className="meet-meta">
            <h2 ref={heading} tabIndex={-1}>
              {meeting.title || "Meeting transcript"}
            </h2>
            <span className="meet-status">
              {new Date(meeting.createdAt).toLocaleString(undefined, {
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
            <a
              className="meet-link meet-status"
              href={meeting.url}
              rel="noreferrer"
              target="_blank"
            >
              Google Meet · {meeting.url.split("/").pop()}
            </a>
          </div>
          <span className="meet-badge" role="status">
            {meetingStatus(meeting)}
          </span>
        </div>
        <div className="meet-row">
          <Button
            disabled={!text}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopyStatus("Transcript copied");
              } catch {
                setCopyStatus(
                  "Could not copy. Select the text to copy it, or download it."
                );
              }
            }}
            size="sm"
            variant="outline"
          >
            Copy transcript
          </Button>
          <Button
            disabled={!text}
            onClick={download}
            size="sm"
            variant="outline"
          >
            Download .txt
          </Button>
          {copyStatus && (
            <span className="meet-status" role="status">
              {copyStatus}
            </span>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        {text ? (
          <Card className="meet-card meet-document">
            <div className="meet-document-text">{text}</div>
          </Card>
        ) : (
          <Card className="meet-card">
            <p className="meet-empty" role="status">
              {loaded
                ? ["queued", "joining", "transcribing"].includes(meeting.state)
                  ? "Waiting for speech…"
                  : "No speech was captured."
                : "Loading transcript…"}
            </p>
          </Card>
        )}
      </section>
    );
  }

  function Page() {
    const [overview, setOverview] = React.useState<Overview | null>(null);
    const [error, setError] = React.useState("");
    const [extensionConnected, setExtensionConnected] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [settings, setSettings] = React.useState<boolean | null>(null);
    const [deleting, setDeleting] = React.useState<Meeting | null>(null);
    const [selected, setSelected] = React.useState<Meeting | null>(null);
    React.useEffect(() => {
      async function receive(event: MessageEvent) {
        if (
          event.source !== window ||
          event.origin !== window.location.origin
        ) {
          return;
        }
        const data = event.data;
        if (data?.type === "NAKAMA_MEET_EXTENSION") {
          setExtensionConnected(data.connected === true);
          return;
        }
        if (
          data?.type !== "NAKAMA_MEET_ACTION" ||
          typeof data.id !== "string" ||
          !["meetings", "start-capture", "leave"].includes(data.action)
        ) {
          return;
        }
        try {
          const result = await ctx.host.call(data.action, data.input);
          window.postMessage(
            { id: data.id, result, type: "NAKAMA_MEET_RESULT" },
            window.location.origin
          );
        } catch (reason) {
          window.postMessage(
            { error: message(reason), id: data.id, type: "NAKAMA_MEET_RESULT" },
            window.location.origin
          );
        }
      }
      window.addEventListener("message", receive);
      const ping = () =>
        window.postMessage(
          { type: "NAKAMA_MEET_PING" },
          window.location.origin
        );
      ping();
      const timer = setInterval(ping, 3000);
      return () => {
        window.removeEventListener("message", receive);
        clearInterval(timer);
      };
    }, []);
    React.useEffect(() => {
      let alive = true;
      let running = false;
      async function refresh() {
        if (!alive || running || ctx.signal.aborted) {
          return;
        }
        running = true;
        try {
          const result = (await ctx.host.call("meetings")) as Overview;
          if (alive && !ctx.signal.aborted) {
            setOverview(result);
          }
        } catch (reason) {
          if (alive) {
            setError(message(reason));
          }
        } finally {
          running = false;
        }
      }
      void refresh();
      const timer = setInterval(() => void refresh(), 3000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, []);
    async function action(name: string, input: unknown) {
      setBusy(true);
      setError("");
      try {
        await ctx.host.call(name, input);
        setOverview((await ctx.host.call("meetings")) as Overview);
      } catch (reason) {
        setError(message(reason));
      } finally {
        setBusy(false);
      }
    }
    const groups = [
      {
        meetings:
          overview?.meetings.filter((meeting) =>
            ["queued", "joining", "transcribing"].includes(meeting.state)
          ) ?? [],
        title: "In progress",
      },
      {
        meetings:
          overview?.meetings.filter((meeting) =>
            ["finished", "failed"].includes(meeting.state)
          ) ?? [],
        title: "Meeting history",
      },
    ];
    if (selected) {
      return (
        <section className="meet-page">
          <Transcript
            close={() => setSelected(null)}
            key={selected.id}
            meeting={
              overview?.meetings.find(
                (meeting) => meeting.id === selected.id
              ) ?? selected
            }
          />
        </section>
      );
    }
    return (
      <section className="meet-page">
        {error && <p role="alert">{error}</p>}
        <Card className="meet-card">
          <div className="meet-card-heading">
            <h2>Transcription</h2>
            {overview?.canConfigure && (
              <Button
                onClick={() => setSettings(true)}
                size="sm"
                variant="outline"
              >
                Settings
              </Button>
            )}
          </div>
          <div
            className="meet-card-heading"
            style={{ borderBottom: 0, borderTop: "1px solid var(--border)" }}
          >
            <span className="meet-status" role="status">
              {overview
                ? overview.configured
                  ? overview.worker.state === "ready"
                    ? extensionConnected
                      ? "Connected. Start transcription from the extension in your Google Meet tab. Keep this page open."
                      : "Open the Chrome extension on this page and choose Connect this Nakama tab."
                    : "Start Google Meet in Workers."
                  : "Set a transcription API key in Settings."
                : "Checking connection…"}
            </span>
          </div>
        </Card>
        {overview ? (
          groups
            .filter(
              (group) => group.title !== "In progress" || group.meetings.length
            )
            .map((group) => (
              <section key={group.title}>
                <Card className="meet-card">
                  <div className="meet-card-heading">
                    <h2>{group.title}</h2>
                    <span className="meet-status">{group.meetings.length}</span>
                  </div>
                  {group.meetings.length ? (
                    <ul className="meet-list">
                      {group.meetings.map((meeting) => (
                        <li key={meeting.id}>
                          <div className="meet-meeting">
                            <div className="meet-meta">
                              <h3>{meeting.title || "Untitled meeting"}</h3>
                              <span className="meet-status">
                                {new Date(meeting.createdAt).toLocaleDateString(
                                  undefined,
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )}
                                {" · "}
                                {new Date(meeting.createdAt).toLocaleTimeString(
                                  undefined,
                                  { hour: "numeric", minute: "2-digit" }
                                )}
                              </span>
                            </div>
                            <div className="meet-row">
                              {meetingStatus(meeting) !==
                                "Transcript ready" && (
                                <span className="meet-badge">
                                  {meetingStatus(meeting)}
                                </span>
                              )}
                              {["queued", "joining", "transcribing"].includes(
                                meeting.state
                              ) && (
                                <Button
                                  className="meet-action"
                                  disabled={busy || !!meeting.stopRequested}
                                  onClick={() =>
                                    void action("leave", {
                                      meetingId: meeting.id,
                                    })
                                  }
                                  size="sm"
                                  variant="outline"
                                >
                                  Stop transcription
                                </Button>
                              )}
                              {["finished", "failed"].includes(
                                meeting.state
                              ) && (
                                <Button
                                  aria-label="Delete meeting"
                                  className="meet-action meet-delete"
                                  disabled={busy}
                                  onClick={() => {
                                    setDeleting(meeting);
                                  }}
                                  size="icon"
                                  title="Delete meeting"
                                  variant="ghost"
                                >
                                  <svg
                                    aria-hidden="true"
                                    fill="none"
                                    height="16"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                    viewBox="0 0 24 24"
                                    width="16"
                                  >
                                    {Delete02Icon.map(([tag, attrs]) =>
                                      React.createElement(tag, attrs)
                                    )}
                                  </svg>
                                </Button>
                              )}
                              <Button
                                aria-label={
                                  meeting.transcriptFile
                                    ? "Read transcript"
                                    : "View details"
                                }
                                className="meet-open"
                                onClick={() => setSelected(meeting)}
                                size="icon"
                                title={
                                  meeting.transcriptFile
                                    ? "Read transcript"
                                    : "View details"
                                }
                                variant="ghost"
                              >
                                <svg
                                  aria-hidden="true"
                                  fill="none"
                                  height="16"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.75"
                                  style={{ color: "var(--muted-foreground)" }}
                                  viewBox="0 0 24 24"
                                  width="16"
                                >
                                  {ArrowRight01Icon.map(([tag, attrs]) =>
                                    React.createElement(tag, {
                                      ...attrs,
                                      strokeWidth: 1.75,
                                    })
                                  )}
                                </svg>
                              </Button>
                            </div>
                          </div>
                          {meeting.error && <p role="alert">{meeting.error}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="meet-empty">No meetings yet.</p>
                  )}
                </Card>
              </section>
            ))
        ) : (
          <p>Loading…</p>
        )}
        {deleting && (
          <ConfirmDialog
            confirmLabel="Delete meeting"
            description={`This permanently deletes the meeting from ${new Date(deleting.createdAt).toLocaleString()} and its transcript. You can’t undo this.`}
            onClose={() => setDeleting(null)}
            onConfirm={async () => {
              await ctx.host.call("delete", { meetingId: deleting.id });
              setOverview((previous) =>
                previous
                  ? {
                      ...previous,
                      meetings: previous.meetings.filter(
                        (meeting) => meeting.id !== deleting.id
                      ),
                    }
                  : previous
              );
            }}
            title="Delete meeting?"
          />
        )}
        {(settings ?? (overview?.canConfigure && !overview.configured)) && (
          <Settings close={() => setSettings(false)} />
        )}
      </section>
    );
  }
  ctx.slots.register("page", Page);
}
