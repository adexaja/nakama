// node_modules/.bun/@hugeicons+core-free-icons@3.3.0/node_modules/@hugeicons/core-free-icons/dist/esm/ArrowRight01Icon.js
var ArrowRight01Icon = [
  ["path", { d: "M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5", key: "0" }]
];
// node_modules/.bun/@hugeicons+core-free-icons@3.3.0/node_modules/@hugeicons/core-free-icons/dist/esm/Delete02Icon.js
var Delete02Icon = [
  ["path", { d: "M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "0" }],
  ["path", { d: "M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "1" }],
  ["path", { d: "M9.5 16.5L9.5 10.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "2" }],
  ["path", { d: "M14.5 16.5L14.5 10.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "3" }]
];
// packages/plugins/google-meet/src/ui.tsx
var message = (error) => error instanceof Error ? error.message : "Request failed";
var inject = ["slots", "host", "styles", "ui"];
function meetingStatus(meeting) {
  if (["queued", "joining", "transcribing"].includes(meeting.state)) {
    return meeting.stopRequested ? "Stopping…" : meeting.state === "transcribing" ? "Transcribing…" : "Connecting…";
  }
  if (meeting.state === "failed") {
    return meeting.transcriptFile ? "Partial transcript" : "Transcription failed";
  }
  return meeting.transcriptFile ? "Transcript ready" : "No speech captured";
}
function apply(ctx) {
  const React = ctx.React;
  const {
    Button,
    Card,
    Input,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    ConfirmDialog
  } = ctx.ui;
  ctx.styles(`
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
    `);
  function Settings({ close }) {
    const [apiKey, setApiKey] = React.useState("");
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    async function save(event) {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        await ctx.host.call("configure", {
          apiKey: apiKey || undefined
        });
        setApiKey("");
        close();
      } catch (reason) {
        setError(message(reason));
      } finally {
        setBusy(false);
      }
    }
    return /* @__PURE__ */ React.createElement(Dialog, {
      onOpenChange: (open) => {
        if (!open) {
          close();
        }
      },
      open: true
    }, /* @__PURE__ */ React.createElement(DialogContent, null, /* @__PURE__ */ React.createElement(DialogHeader, null, /* @__PURE__ */ React.createElement(DialogTitle, null, "Google Meet settings")), /* @__PURE__ */ React.createElement("form", {
      className: "meet-form",
      onSubmit: save
    }, /* @__PURE__ */ React.createElement("label", null, "OpenAI API key", /* @__PURE__ */ React.createElement(Input, {
      autoComplete: "off",
      onChange: (event) => setApiKey(event.target.value),
      placeholder: "Keep saved key",
      type: "password",
      value: apiKey
    })), /* @__PURE__ */ React.createElement("p", {
      className: "meet-status"
    }, "gpt-transcribe uses separate API billing. Your ChatGPT subscription does not cover transcription."), /* @__PURE__ */ React.createElement("p", {
      className: "meet-status"
    }, "Open the Nakama Chrome extension on this page and connect it. Then start transcription from the extension in your Meet tab."), error && /* @__PURE__ */ React.createElement("p", {
      role: "alert"
    }, error), /* @__PURE__ */ React.createElement(Button, {
      disabled: busy,
      type: "submit"
    }, busy ? "Saving…" : "Save"))));
  }
  function Transcript({ meeting, close }) {
    const [text, setText] = React.useState("");
    const [error, setError] = React.useState("");
    const [loaded, setLoaded] = React.useState(false);
    const [copyStatus, setCopyStatus] = React.useState("");
    const heading = React.useRef(null);
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
          const value = await ctx.host.call("transcript", {
            after: cursor,
            meetingId: meeting.id
          });
          if (alive && !ctx.signal.aborted) {
            cursor = value.nextCursor;
            setText((previous) => previous + value.segments.map((segment) => segment.text + `
`).join(""));
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
      refresh();
      const timer = setInterval(() => void refresh(), 2000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [meeting.id]);
    function download() {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `meeting-${new Date(meeting.createdAt).toISOString().slice(0, 10)}-${meeting.url.split("/").pop()}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return /* @__PURE__ */ React.createElement("section", {
      className: "meet-detail"
    }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Button, {
      onClick: close,
      size: "sm",
      variant: "ghost"
    }, "← Back to meetings")), /* @__PURE__ */ React.createElement("div", {
      className: "meet-detail-heading"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "meet-meta"
    }, /* @__PURE__ */ React.createElement("h2", {
      ref: heading,
      tabIndex: -1
    }, meeting.title || "Meeting transcript"), /* @__PURE__ */ React.createElement("span", {
      className: "meet-status"
    }, new Date(meeting.createdAt).toLocaleString(undefined, {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "long",
      year: "numeric"
    })), /* @__PURE__ */ React.createElement("a", {
      className: "meet-link meet-status",
      href: meeting.url,
      rel: "noreferrer",
      target: "_blank"
    }, "Google Meet · ", meeting.url.split("/").pop())), /* @__PURE__ */ React.createElement("span", {
      className: "meet-badge",
      role: "status"
    }, meetingStatus(meeting))), /* @__PURE__ */ React.createElement("div", {
      className: "meet-row"
    }, /* @__PURE__ */ React.createElement(Button, {
      disabled: !text,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopyStatus("Transcript copied");
        } catch {
          setCopyStatus("Could not copy. Select the text to copy it, or download it.");
        }
      },
      size: "sm",
      variant: "outline"
    }, "Copy transcript"), /* @__PURE__ */ React.createElement(Button, {
      disabled: !text,
      onClick: download,
      size: "sm",
      variant: "outline"
    }, "Download .txt"), copyStatus && /* @__PURE__ */ React.createElement("span", {
      className: "meet-status",
      role: "status"
    }, copyStatus)), error && /* @__PURE__ */ React.createElement("p", {
      role: "alert"
    }, error), text ? /* @__PURE__ */ React.createElement(Card, {
      className: "meet-card meet-document"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "meet-document-text"
    }, text)) : /* @__PURE__ */ React.createElement(Card, {
      className: "meet-card"
    }, /* @__PURE__ */ React.createElement("p", {
      className: "meet-empty",
      role: "status"
    }, loaded ? ["queued", "joining", "transcribing"].includes(meeting.state) ? "Waiting for speech…" : "No speech was captured." : "Loading transcript…")));
  }
  function Page() {
    const [overview, setOverview] = React.useState(null);
    const [error, setError] = React.useState("");
    const [extensionConnected, setExtensionConnected] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [settings, setSettings] = React.useState(null);
    const [deleting, setDeleting] = React.useState(null);
    const [selected, setSelected] = React.useState(null);
    React.useEffect(() => {
      async function receive(event) {
        if (event.source !== window || event.origin !== window.location.origin) {
          return;
        }
        const data = event.data;
        if (data?.type === "NAKAMA_MEET_EXTENSION") {
          setExtensionConnected(data.connected === true);
          return;
        }
        if (data?.type !== "NAKAMA_MEET_ACTION" || typeof data.id !== "string" || !["meetings", "start-capture", "leave"].includes(data.action)) {
          return;
        }
        try {
          const result = await ctx.host.call(data.action, data.input);
          window.postMessage({ id: data.id, result, type: "NAKAMA_MEET_RESULT" }, window.location.origin);
        } catch (reason) {
          window.postMessage({ error: message(reason), id: data.id, type: "NAKAMA_MEET_RESULT" }, window.location.origin);
        }
      }
      window.addEventListener("message", receive);
      const ping = () => window.postMessage({ type: "NAKAMA_MEET_PING" }, window.location.origin);
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
          const result = await ctx.host.call("meetings");
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
      refresh();
      const timer = setInterval(() => void refresh(), 3000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, []);
    async function action(name, input) {
      setBusy(true);
      setError("");
      try {
        await ctx.host.call(name, input);
        setOverview(await ctx.host.call("meetings"));
      } catch (reason) {
        setError(message(reason));
      } finally {
        setBusy(false);
      }
    }
    const groups = [
      {
        meetings: overview?.meetings.filter((meeting) => ["queued", "joining", "transcribing"].includes(meeting.state)) ?? [],
        title: "In progress"
      },
      {
        meetings: overview?.meetings.filter((meeting) => ["finished", "failed"].includes(meeting.state)) ?? [],
        title: "Meeting history"
      }
    ];
    if (selected) {
      return /* @__PURE__ */ React.createElement("section", {
        className: "meet-page"
      }, /* @__PURE__ */ React.createElement(Transcript, {
        close: () => setSelected(null),
        key: selected.id,
        meeting: overview?.meetings.find((meeting) => meeting.id === selected.id) ?? selected
      }));
    }
    return /* @__PURE__ */ React.createElement("section", {
      className: "meet-page"
    }, error && /* @__PURE__ */ React.createElement("p", {
      role: "alert"
    }, error), /* @__PURE__ */ React.createElement(Card, {
      className: "meet-card"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "meet-card-heading"
    }, /* @__PURE__ */ React.createElement("h2", null, "Transcription"), overview?.canConfigure && /* @__PURE__ */ React.createElement(Button, {
      onClick: () => setSettings(true),
      size: "sm",
      variant: "outline"
    }, "Settings")), /* @__PURE__ */ React.createElement("div", {
      className: "meet-card-heading",
      style: { borderBottom: 0, borderTop: "1px solid var(--border)" }
    }, /* @__PURE__ */ React.createElement("span", {
      className: "meet-status",
      role: "status"
    }, overview ? overview.configured ? overview.worker.state === "ready" ? extensionConnected ? "Connected. Start transcription from the extension in your Google Meet tab. Keep this page open." : "Open the Chrome extension on this page and choose Connect this Nakama tab." : "Start Google Meet in Workers." : "Set a transcription API key in Settings." : "Checking connection…"))), overview ? groups.filter((group) => group.title !== "In progress" || group.meetings.length).map((group) => /* @__PURE__ */ React.createElement("section", {
      key: group.title
    }, /* @__PURE__ */ React.createElement(Card, {
      className: "meet-card"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "meet-card-heading"
    }, /* @__PURE__ */ React.createElement("h2", null, group.title), /* @__PURE__ */ React.createElement("span", {
      className: "meet-status"
    }, group.meetings.length)), group.meetings.length ? /* @__PURE__ */ React.createElement("ul", {
      className: "meet-list"
    }, group.meetings.map((meeting) => /* @__PURE__ */ React.createElement("li", {
      key: meeting.id
    }, /* @__PURE__ */ React.createElement("div", {
      className: "meet-meeting"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "meet-meta"
    }, /* @__PURE__ */ React.createElement("h3", null, meeting.title || "Untitled meeting"), /* @__PURE__ */ React.createElement("span", {
      className: "meet-status"
    }, new Date(meeting.createdAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    }), " · ", new Date(meeting.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))), /* @__PURE__ */ React.createElement("div", {
      className: "meet-row"
    }, meetingStatus(meeting) !== "Transcript ready" && /* @__PURE__ */ React.createElement("span", {
      className: "meet-badge"
    }, meetingStatus(meeting)), ["queued", "joining", "transcribing"].includes(meeting.state) && /* @__PURE__ */ React.createElement(Button, {
      className: "meet-action",
      disabled: busy || !!meeting.stopRequested,
      onClick: () => void action("leave", {
        meetingId: meeting.id
      }),
      size: "sm",
      variant: "outline"
    }, "Stop transcription"), ["finished", "failed"].includes(meeting.state) && /* @__PURE__ */ React.createElement(Button, {
      "aria-label": "Delete meeting",
      className: "meet-action meet-delete",
      disabled: busy,
      onClick: () => {
        setDeleting(meeting);
      },
      size: "icon",
      title: "Delete meeting",
      variant: "ghost"
    }, /* @__PURE__ */ React.createElement("svg", {
      "aria-hidden": "true",
      fill: "none",
      height: "16",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: "1.5",
      viewBox: "0 0 24 24",
      width: "16"
    }, Delete02Icon.map(([tag, attrs]) => React.createElement(tag, attrs)))), /* @__PURE__ */ React.createElement(Button, {
      "aria-label": meeting.transcriptFile ? "Read transcript" : "View details",
      className: "meet-open",
      onClick: () => setSelected(meeting),
      size: "icon",
      title: meeting.transcriptFile ? "Read transcript" : "View details",
      variant: "ghost"
    }, /* @__PURE__ */ React.createElement("svg", {
      "aria-hidden": "true",
      fill: "none",
      height: "16",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: "1.75",
      style: { color: "var(--muted-foreground)" },
      viewBox: "0 0 24 24",
      width: "16"
    }, ArrowRight01Icon.map(([tag, attrs]) => React.createElement(tag, {
      ...attrs,
      strokeWidth: 1.75
    })))))), meeting.error && /* @__PURE__ */ React.createElement("p", {
      role: "alert"
    }, meeting.error)))) : /* @__PURE__ */ React.createElement("p", {
      className: "meet-empty"
    }, "No meetings yet.")))) : /* @__PURE__ */ React.createElement("p", null, "Loading…"), deleting && /* @__PURE__ */ React.createElement(ConfirmDialog, {
      confirmLabel: "Delete meeting",
      description: `This permanently deletes the meeting from ${new Date(deleting.createdAt).toLocaleString()} and its transcript. You can’t undo this.`,
      onClose: () => setDeleting(null),
      onConfirm: async () => {
        await ctx.host.call("delete", { meetingId: deleting.id });
        setOverview((previous) => previous ? {
          ...previous,
          meetings: previous.meetings.filter((meeting) => meeting.id !== deleting.id)
        } : previous);
      },
      title: "Delete meeting?"
    }), (settings ?? (overview?.canConfigure && !overview.configured)) && /* @__PURE__ */ React.createElement(Settings, {
      close: () => setSettings(false)
    }));
  }
  ctx.slots.register("page", Page);
}
export {
  apply,
  inject
};
