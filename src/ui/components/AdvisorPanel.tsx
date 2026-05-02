import { FormEvent, useState } from "react";
import type { AdvisorMessage, PortfolioSnapshot } from "../../domain/portfolio/types";
import { requestGroqAdvisorResponse } from "../../infrastructure/analytics/LocalGroqAdvisorClient";
import { getAdvisorResponse } from "../../usecases/getAdvisorResponse";
import { formatDateTime } from "../formatters";
import { Badge } from "./Badge";
import type { Language } from "../i18n";
import { TerminalIcon } from "./TerminalIcon";

interface AdvisorPanelProps {
  snapshot: PortfolioSnapshot;
  language: Language;
}

const parseAdvisorSections = (content: string): Array<{ title: string; body: string }> => {
  const markers = ["Summary", "Key Risks", "Actionable Insights"];
  const markerPattern = new RegExp(`(${markers.join("|")}):`, "g");
  const matches = [...content.matchAll(markerPattern)];

  if (matches.length === 0) {
    return [{ title: "Answer", body: content }];
  }

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;

    return {
      title: match[1],
      body: content.slice(start, end).trim()
    };
  });
};

const AdvisorMessageContent = ({ content }: { content: string }) => {
  const sections = parseAdvisorSections(content);

  if (sections.length === 1 && sections[0].title === "Answer") {
    return <p>{sections[0].body}</p>;
  }

  return (
    <div className="advisor-answer">
      {sections.map((section) => (
        <section key={section.title} className="advisor-answer-section">
          <h3>{section.title}</h3>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  );
};

export const AdvisorPanel = ({ snapshot, language }: AdvisorPanelProps) => {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerStatus, setProviderStatus] = useState<"idle" | "ok" | "missing_key" | "quota_exceeded" | "provider_error">("idle");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    const createdAt = new Date().toISOString();
    setIsSubmitting(true);

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: crypto.randomUUID(), role: "user", content: trimmedQuestion, createdAt }
    ]);
    setQuestion("");

    try {
      const response = await requestGroqAdvisorResponse(trimmedQuestion, snapshot, language);
      setProviderStatus(response.providerStatus);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: response.text,
          sourceLabel: response.source === "groq" ? `Groq / ${response.model ?? "model"}` : response.providerStatus,
          createdAt: new Date().toISOString()
        }
      ]);
    } catch {
      setProviderStatus("provider_error");
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: getAdvisorResponse(trimmedQuestion, snapshot),
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside className="advisor-panel">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-medium text-slate-950">{language === "ru" ? "AI аналитика" : "AI Analytics"}</h2>
          <p className="mt-1 text-xs text-slate-500">{language === "ru" ? "Ответ появляется только после запроса" : "Answers appear only after a query"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={providerStatus === "ok" ? "success" : providerStatus === "idle" ? "neutral" : providerStatus === "quota_exceeded" ? "warning" : "danger"}>
            {providerStatus === "idle" ? "AI" : providerStatus === "ok" ? "Groq" : providerStatus}
          </Badge>
          <TerminalIcon name="message" size={18} className="text-navy" />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "message message-user" : "message message-system"}>
            <div className="mb-2 font-mono text-[10px] uppercase text-slate-400">
              {formatDateTime(message.createdAt)}
              {message.sourceLabel ? ` / ${message.sourceLabel}` : ""}
            </div>
            {message.role === "system" ? <AdvisorMessageContent content={message.content} /> : <p>{message.content}</p>}
          </article>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
        <label className="sr-only" htmlFor="advisor-question">
          {language === "ru" ? "Запрос" : "Query"}
        </label>
        <div className="flex gap-2">
          <input
            id="advisor-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={language === "ru" ? "Спросить про риск или квантовый расчет" : "Ask about risk or the quantum run"}
            className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <button className="icon-button" type="submit" title="Send query" aria-label="Send query" disabled={isSubmitting}>
            <TerminalIcon name="send" size={17} />
          </button>
        </div>
      </form>
    </aside>
  );
};
