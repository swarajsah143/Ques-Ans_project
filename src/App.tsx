import { useEffect, useRef, useState, type FormEvent } from "react";

type StreamEvent =
  | { type: "meta"; temperature: number }
  | { type: "chunk"; text: string }
  | { type: "sources"; sources: WebSource[] }
  | { type: "done" }
  | { type: "error"; error: string };

interface WebSource {
  title: string;
  url: string;
}

type Phase = "idle" | "thinking" | "dousing";

function Watermark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M3 13c2.25 0 2.25-2 4.5-2s2.25 2 4.5 2 2.25-2 4.5-2 2.25 2 4.5 2M3 18c2.25 0 2.25-2 4.5-2s2.25 2 4.5 2 2.25-2 4.5-2 2.25 2 4.5 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M12 3.5c1.7 2.05 2.55 3.52 2.55 4.42a2.55 2.55 0 1 1-5.1 0C9.45 7.02 10.3 5.55 12 3.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    </span>
  );
}

function ElementalEffect({ phase }: { phase: Phase }) {
  return (
    <div className={`elemental-effect ${phase}`} aria-hidden="true">
      <div className="fire-field">
        <div className="fire-origin" />
        <div className="flame-layer">
          {Array.from({ length: 16 }, (_, index) => (
            <span
              className="flame-tongue"
              key={`flame-${index}`}
              style={{
                left: `${(index * 47 + 3) % 100}%`,
                height: `${76 + ((index * 29) % 65)}vh`,
                width: `${12 + ((index * 13) % 9)}vw`,
                animationDelay: `${-((index * 31) % 43) / 10}s`,
              }}
            />
          ))}
        </div>
        <div className="ember-layer">
          {Array.from({ length: 24 }, (_, index) => (
            <span
              key={`ember-${index}`}
              style={{
                left: `${(index * 41 + 8) % 100}%`,
                animationDelay: `${-((index * 17) % 53) / 10}s`,
                animationDuration: `${4 + ((index * 11) % 40) / 10}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="rain-field">
        {Array.from({ length: 72 }, (_, index) => (
          <span
            key={`rain-${index}`}
            style={{
              left: `${(index * 37 + 2) % 100}%`,
              animationDelay: `${-((index * 13) % 75) / 100}s`,
              animationDuration: `${0.48 + ((index * 7) % 45) / 100}s`,
              height: `${18 + ((index * 11) % 27)}px`,
            }}
          />
        ))}
      </div>
      <div className="rain-splash" />
    </div>
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<WebSource[]>([]);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const douseTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(douseTimerRef.current);
    },
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSubmitting) return;

    window.clearTimeout(douseTimerRef.current);
    const buttonBounds = buttonRef.current?.getBoundingClientRect();
    if (buttonBounds) {
      document.documentElement.style.setProperty(
        "--fire-origin-x",
        `${buttonBounds.left + buttonBounds.width / 2}px`,
      );
      document.documentElement.style.setProperty(
        "--fire-origin-y",
        `${buttonBounds.top + buttonBounds.height / 2}px`,
      );
    }

    setIsSubmitting(true);
    setPhase("thinking");
    setHasError(false);
    setSources([]);
    setAnswer("Connecting to your local model…");
    answerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    let hasReceivedText = false;
    let streamedAnswer = "";
    let answerUpdateTimer: number | undefined;

    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });

      if (!response.ok) throw new Error(await readError(response));
      if (!response.body) {
        throw new Error("Streaming is not supported by this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function flushAnswer() {
        window.clearTimeout(answerUpdateTimer);
        answerUpdateTimer = undefined;
        setAnswer(streamedAnswer);
      }

      function handleEvent(line: string) {
        if (!line.trim()) return;
        const data = JSON.parse(line) as StreamEvent;

        if (data.type === "meta") setTemperature(data.temperature);
        if (data.type === "sources") setSources(data.sources);
        if (data.type === "chunk") {
          hasReceivedText = true;
          streamedAnswer += data.text;
          if (answerUpdateTimer === undefined) {
            answerUpdateTimer = window.setTimeout(flushAnswer, 80);
          }
        }
        if (data.type === "error") throw new Error(data.error);
      }

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) handleEvent(line);
        if (done) break;
      }

      if (buffer.trim()) handleEvent(buffer);
      if (!hasReceivedText) throw new Error("The local model returned an empty answer. Try again.");
      flushAnswer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setHasError(true);
      window.clearTimeout(answerUpdateTimer);
      setAnswer(hasReceivedText ? `${streamedAnswer}\n\n${message}` : message);
    } finally {
      setIsSubmitting(false);
      setPhase("dousing");
      douseTimerRef.current = window.setTimeout(() => setPhase("idle"), 1900);
    }
  }

  return (
    <main className={`app-shell ${phase}`}>
      <ElementalEffect phase={phase} />
      <div className="ambient" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Stillwater home">
            <Watermark />
            Stillwater
          </a>
          <span className="privacy">A calmer way to find clarity</span>
        </header>

        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">A little more clarity</p>
          <h1 id="page-title">
            Ask anything.
            <br />
            <span>Find your answer.</span>
          </h1>
          <p className="intro">
            Thoughtful, focused answers with a little less noise. Ask a question
            and let the current find its course.
          </p>
        </section>

        <form onSubmit={handleSubmit}>
          <section className="panel" aria-label="Ask a question">
            <div className="panel-top">
              <div>
                <span className="field-label">Local model</span>
                <p className="model-name">Gemma 3 · 1B</p>
              </div>
              <p className="provider-note">
                Gemma answers locally; current-information questions also use Tavily web search.
              </p>
            </div>
            <div className="question-area">
              <label className="field-label" htmlFor="question">
                Your question
              </label>
              <textarea
                id="question"
                name="question"
                value={question}
                onChange={event => setQuestion(event.target.value)}
                placeholder="What would you like to understand?"
                maxLength={4000}
                required
              />
              <div className="submit-row">
                <span className="hint">
                  {isSubmitting
                    ? "A little fire while your answer takes shape…"
                    : "Answers stream in as they’re generated."}
                </span>
                <button ref={buttonRef} type="submit" disabled={isSubmitting}>
                  <span>{isSubmitting ? "Thinking" : "Find an answer"}</span>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4 10h11m-4-4 4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </form>

        <section className="answer-section" aria-live="polite" aria-atomic="false">
          <div className="answer-heading">
            <h2>Your answer</h2>
            <span className="temperature">
              ◌ <span>Temperature</span>{" "}
              <strong>{temperature === null ? "—" : temperature.toFixed(2)}</strong>
            </span>
          </div>
          <div
            className={`answer-box${answer ? "" : " placeholder"}${hasError ? " error" : ""}`}
            ref={answerRef}
            role="status"
          >
            {answer || "Your answer will appear here. Each response is tuned to the question you ask."}
          </div>
          {sources.length > 0 && (
            <div className="sources-box">
              <h3>Web sources</h3>
              <ol>
                {sources.map((source, index) => (
                  <li key={`${source.url}-${index}`}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
        <p className="footer-note">
          Current-information questions are sent to Tavily for search; answers are generated
          locally by Gemma.
        </p>
      </div>
    </main>
  );
}
