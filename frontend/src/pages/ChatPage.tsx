import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm the EnergyOS Assistant, powered by Claude. I can help you understand European electricity markets — prices, generation mix (solar, wind, nuclear…), consumption, and more. What would you like to know?",
};

export default function ChatPage() {
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message  = { role: "user", content: text };
    const history           = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError(null);
    setStreaming(true);

    // Placeholder for the streaming assistant reply
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
      // Remove the empty assistant placeholder on error
      setMessages(prev => prev[prev.length - 1].content === "" ? prev.slice(0, -1) : prev);
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "calc(100vh - 57px)",
      maxWidth: 860, margin: "0 auto", padding: "0 16px",
    }}>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0 12px" }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 14,
            }}
          >
            {msg.role === "assistant" && (
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg,#3182ce,#805ad5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
                flexShrink: 0, marginRight: 10, marginTop: 2,
              }}>
                ⚡
              </div>
            )}
            <div style={{
              maxWidth: "72%",
              background: msg.role === "user" ? "#2b4c7e" : "#1a1f2e",
              border: `1px solid ${msg.role === "user" ? "#3182ce" : "#2d3748"}`,
              borderRadius: msg.role === "user"
                ? "18px 18px 4px 18px"
                : "18px 18px 18px 4px",
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {msg.content || (
                <span style={{ color: "#4a5568" }}>
                  <span style={{ animation: "pulse 1s infinite" }}>●</span>
                  <span style={{ animation: "pulse 1s 0.2s infinite", marginLeft: 4 }}>●</span>
                  <span style={{ animation: "pulse 1s 0.4s infinite", marginLeft: 4 }}>●</span>
                </span>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div style={{
            background: "#2d1515", border: "1px solid #822", borderRadius: 8,
            padding: "8px 14px", color: "#fc8181", fontSize: 13, marginBottom: 14,
          }}>
            Error: {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        borderTop: "1px solid #2d3748", padding: "14px 0 20px",
        display: "flex", gap: 10, alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={streaming}
          placeholder="Ask about European energy markets… (Enter to send, Shift+Enter for newline)"
          rows={1}
          style={{
            flex: 1,
            background: "#1a1f2e",
            border: "1px solid #2d3748",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#e2e8f0",
            fontSize: 14,
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            maxHeight: 160,
            overflowY: "auto",
            opacity: streaming ? 0.6 : 1,
          }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          style={{
            background: streaming || !input.trim() ? "#2d3748" : "#3182ce",
            color: "#e2e8f0",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          {streaming ? "…" : "Send"}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
