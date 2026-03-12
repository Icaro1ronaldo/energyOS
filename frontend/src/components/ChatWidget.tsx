import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm the EnergyOS Assistant. Ask me anything about European electricity markets — prices, generation mix, forecasts, and more.",
};

export default function ChatWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const history          = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError(null);
    setStreaming(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/v1/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          let chunk: string;
          try { chunk = JSON.parse(raw); } catch { chunk = raw; }
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMessages(prev => prev[prev.length - 1].content === "" ? prev.slice(0, -1) : prev);
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const unread = !open && messages.length > 1;

  return (
    <>
      {/* Floating panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 80, right: 24, zIndex: 1000,
          width: 360, height: 520,
          background: "#0f1117", border: "1px solid #2d3748", borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", background: "#1a1f2e", borderBottom: "1px solid #2d3748",
            flexShrink: 0,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg,#0ea5e9,#0077b6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, flexShrink: 0,
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>EnergyOS Assistant</div>
              <div style={{ fontSize: 11, color: "#4a5568" }}>Powered by Claude</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                marginLeft: "auto", background: "transparent", border: "none",
                color: "#4a5568", fontSize: 18, cursor: "pointer", lineHeight: 1,
                padding: "0 2px",
              }}
              title="Collapse"
            >×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px 8px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "linear-gradient(135deg,#0ea5e9,#0077b6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, flexShrink: 0, marginRight: 7, marginTop: 2,
                  }}>⚡</div>
                )}
                <div style={{
                  maxWidth: "80%",
                  background: msg.role === "user" ? "#2b4c7e" : "#1a1f2e",
                  border: `1px solid ${msg.role === "user" ? "#3182ce" : "#2d3748"}`,
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "8px 12px",
                  color: "#e2e8f0", fontSize: 13, lineHeight: 1.55,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.content || (
                    <span style={{ color: "#4a5568" }}>
                      <span style={{ animation: "pulse 1s infinite" }}>●</span>
                      <span style={{ animation: "pulse 1s 0.2s infinite", marginLeft: 3 }}>●</span>
                      <span style={{ animation: "pulse 1s 0.4s infinite", marginLeft: 3 }}>●</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {error && (
              <div style={{
                background: "#2d1515", border: "1px solid #822", borderRadius: 8,
                padding: "6px 12px", color: "#fc8181", fontSize: 12, marginBottom: 10,
              }}>
                Error: {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: "1px solid #2d3748", padding: "10px 12px",
            display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={streaming}
              placeholder="Ask about energy markets… (Enter to send)"
              rows={1}
              style={{
                flex: 1, background: "#1a1f2e", border: "1px solid #2d3748",
                borderRadius: 8, padding: "8px 10px", color: "#e2e8f0",
                fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit",
                lineHeight: 1.5, maxHeight: 100, overflowY: "auto",
                opacity: streaming ? 0.6 : 1,
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
              }}
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              style={{
                background: streaming || !input.trim() ? "rgba(0,0,0,0.08)" : "#0077b6",
                color: "#e2e8f0", border: "none", borderRadius: 8,
                padding: "8px 14px", fontSize: 13, cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
                fontWeight: 600, transition: "background 0.15s", flexShrink: 0,
              }}
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Launcher bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1001,
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "rgba(0,112,184,0.3)" : "linear-gradient(135deg,#0ea5e9,#0077b6)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          transition: "background 0.2s, transform 0.15s",
          fontSize: 22,
          transform: open ? "scale(0.92)" : "scale(1)",
        }}
        title={open ? "Close chat" : "Open EnergyOS Assistant"}
      >
        {open ? "×" : "⚡"}
        {unread && (
          <div style={{
            position: "absolute", top: 4, right: 4,
            width: 10, height: 10, borderRadius: "50%",
            background: "#68d391", border: "2px solid #0f1117",
          }} />
        )}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1; }
        }
      `}</style>
    </>
  );
}
