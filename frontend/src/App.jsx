import { useState } from 'react';

function App() {
  const [originalText, setOriginalText] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [result, setResult] = useState("");

  const handleGenerate = async () => {
    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText })
      });
      if (!response.ok) {
        // Pokud server vrátil chybu, vyhodíme ji pro zobrazení
        const errorData = await response.json();
        throw new Error(errorData.detail || "Chyba při generování poznámek");
      }
      const data = await response.json();
      setResult(data.notes);  // nastaví vygenerované poznámky do stavu
    } catch (error) {
      console.error("Chyba:", error);
      // Zde můžeme zobrazit uživateli chybovou hlášku (např. alert nebo na stránce)
    }
  };

  const handleCorrect = async () => {
    try {
      const response = await fetch("/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original: originalText, notes: studentNotes })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Chyba při úpravě poznámek");
      }
      const data = await response.json();
      setResult(data.corrected_notes);  // nastaví opravené poznámky do stavu
    } catch (error) {
      console.error("Chyba:", error);
      // Případné zobrazení chyby uživateli
    }
  };

  return (
    <div>
      <h1>AI Studijní Poznámky</h1>

      <div>
        <h2>Originální text</h2>
        <textarea
          rows="6"
          value={originalText}
          onChange={(e) => setOriginalText(e.target.value)}
          placeholder="Vlož sem původní text lekce..."
        />
      </div>

      <div>
        <h2>Studentské poznámky</h2>
        <textarea
          rows="6"
          value={studentNotes}
          onChange={(e) => setStudentNotes(e.target.value)}
          placeholder="Pokud chceš zkontrolovat vlastní poznámky, vlož je sem..."
        />
      </div>

      <div>
        <button onClick={handleGenerate}>Generovat poznámky</button>
        <button onClick={handleCorrect}>Upravit poznámky</button>
      </div>

      <div>
        <h2>Výsledné poznámky</h2>
        <textarea rows="6" value={result} readOnly />
      </div>
    </div>
  );
}

export default App;
