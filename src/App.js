import { useState, useEffect } from "react";
import { supabase, useSession, authHeaders } from "./pd1hub";

const SUPABASE_TABLE = "pd1_flashcards";

const WEEKS = [
  { week: 1, title: "Fundamentals & Data Modeling", topics: ["Objects, fields, relationships (lookup/master-detail/many-to-many)", "Schema builder", "Data import/export, Data Loader", "Deduplication & validation rules"] },
  { week: 2, title: "Apex Fundamentals", topics: ["Apex syntax, data types, collections (List/Set/Map)", "SOQL & SOSL basics", "Classes & triggers, trigger context variables", "Trigger order of execution", "Governor limits (key numbers)"] },
  { week: 3, title: "Async Apex & Bulkification", topics: ["Bulkification patterns (no SOQL/DML in loops)", "@future methods", "Batch Apex incl. Database.Stateful", "Queueable Apex", "Scheduled Apex"] },
  { week: 4, title: "Process Automation & UI", topics: ["Flow (record-triggered, screen flows)", "Flow vs Apex trigger, order of execution", "Visualforce basics (controllers, extensions)", "LWC basics (@api, @track, @wire, component comms)"] },
  { week: 5, title: "Testing & Debugging", topics: ["Test classes, @isTest, Test.startTest/stopTest", "Test data factories & assertions", "Debug logs & Checkpoints", "Common exceptions"] },
  { week: 6, title: "Targeted Review & Mocks", topics: ["Governor limits", "Order of execution", "Async use-cases", "Flow vs Apex decision making"] },
];

function FlashCard({ card, index }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      style={{ perspective: "1000px", cursor: "pointer", height: 200 }}
    >
      <div style={{
        position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.5s ease",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* Front */}
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          backfaceVisibility: "hidden",
          background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, boxSizing: "border-box",
        }}>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            Card {index + 1} · Click to reveal
          </div>
          <div style={{ fontSize: 15, color: "#e2e8f0", textAlign: "center", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
            {card.question}
          </div>
        </div>

        {/* Back */}
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          backfaceVisibility: "hidden", transform: "rotateY(180deg)",
          background: "#0f2027", border: "1px solid #22c55e44", borderRadius: 12,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, boxSizing: "border-box",
        }}>
          <div style={{ fontSize: 10, color: "#22c55e88", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            Answer
          </div>
          <div style={{ fontSize: 14, color: "#86efac", textAlign: "center", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
            {card.answer}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const userId = useSession().user.id;
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Last generated set for each week, saved to Supabase: { "1": [...], "2": [...] }
  const [cardsByWeek, setCardsByWeek] = useState({});

  const week = WEEKS.find(w => w.week === selectedWeek);

  useEffect(() => {
    (async () => {
      const { data, error: loadError } = await supabase
        .from(SUPABASE_TABLE)
        .select("cards_by_week, selected_week")
        .eq("user_id", userId)
        .maybeSingle();
      if (loadError) {
        console.error("Supabase load failed", loadError);
        return;
      }
      if (data) {
        const saved = data.cards_by_week || {};
        const wk = data.selected_week || 1;
        setCardsByWeek(saved);
        setSelectedWeek(wk);
        setCards(saved[wk] || []);
      }
    })();
  }, [userId]);

  const save = async (nextCardsByWeek, nextWeek) => {
    const { error: saveError } = await supabase.from(SUPABASE_TABLE).upsert({
      user_id: userId,
      cards_by_week: nextCardsByWeek,
      selected_week: nextWeek,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) console.error("Supabase save failed", saveError);
  };

  const selectWeek = (wk) => {
    setSelectedWeek(wk);
    setCards(cardsByWeek[wk] || []);
    save(cardsByWeek, wk);
  };

  const generate = async () => {
    setLoading(true);
    setCards([]);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: `You are a Salesforce PD1 certification flashcard generator.
Generate exactly 6 flashcards for the given topics.
Respond ONLY with a valid JSON array, no explanation, no markdown. Format:
[{"question": "...", "answer": "..."}]
Keep questions concise and exam-style. Keep answers under 2 sentences.`,
          messages: [{
            role: "user",
            content: `Generate 6 flashcards for Week ${week.week}: ${week.title}. Topics: ${week.topics.join(", ")}.`
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "[]";
      const parsed = JSON.parse(text);
      setCards(parsed);
      const nextCardsByWeek = { ...cardsByWeek, [selectedWeek]: parsed };
      setCardsByWeek(nextCardsByWeek);
      save(nextCardsByWeek, selectedWeek);
    } catch {
      setError("Failed to generate cards. Is the server running?");
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#060b14", color: "#e2e8f0",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: "40px 24px",
    }}>
      <style>{`* { box-sizing: border-box; } select { appearance: none; }`}</style>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
            Salesforce PD1
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#f1f5f9" }}>
            Study <span style={{ color: "#00D4FF" }}>Flashcards</span>
          </h1>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, marginBottom: 40, justifyContent: "center", flexWrap: "wrap" }}>
          <select
            value={selectedWeek}
            onChange={(e) => selectWeek(Number(e.target.value))}
            style={{
              background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0",
              padding: "10px 16px", borderRadius: 8, fontSize: 14, fontFamily: "inherit",
              cursor: "pointer", minWidth: 280,
            }}
          >
            {WEEKS.map(w => (
              <option key={w.week} value={w.week}>Week {w.week} — {w.title}</option>
            ))}
          </select>

          <button
            onClick={generate}
            disabled={loading}
            style={{
              background: loading ? "#1e293b" : "#00D4FF", border: "none", borderRadius: 8,
              padding: "10px 24px", color: loading ? "#475569" : "#000",
              fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            {loading ? "Generating..." : "Generate Cards"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: "#f87171", textAlign: "center", marginBottom: 24, fontSize: 14 }}>{error}</div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 200, background: "#1e293b", borderRadius: 12, border: "1px solid #334155", opacity: 0.5 }} />
            ))}
          </div>
        )}

        {/* Cards */}
        {cards.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace", textAlign: "center", marginBottom: 20 }}>
              {cards.length} cards generated · click any card to flip
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {cards.map((card, i) => (
                <FlashCard key={i} card={card} index={i} />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <button
                onClick={generate}
                style={{
                  background: "transparent", border: "1px solid #334155",
                  color: "#64748b", padding: "8px 20px", borderRadius: 8,
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ↺ Generate new set
              </button>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && cards.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "#334155", fontSize: 14, marginTop: 60 }}>
            Select a week and hit Generate Cards to start studying.
          </div>
        )}

      </div>
    </div>
  );
}
