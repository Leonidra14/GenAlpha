import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import {
  getClassStudents,
  addExistingStudent,
  createAndEnrollStudent,
  removeStudent,
  setStudentPassword,
  getAvailableStudents,
} from "../api/api";

export default function ClassStudentsModal({ open, onClose, classId, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [students, setStudents] = useState([]);

  // available (not enrolled) students
  const [available, setAvailable] = useState([]);
  const [search, setSearch] = useState("");

  // create + enroll
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // password change
  const [pwOpenFor, setPwOpenFor] = useState(null);
  const [newPw, setNewPw] = useState("");

  async function loadStudents() {
    if (!classId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await getClassStudents(classId);
      setStudents(data || []);
    } catch (e) {
      setErr(e?.message || "Nepodařilo se načíst studenty.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailable(q = "") {
    if (!classId) return;
    setErr("");
    try {
      const data = await getAvailableStudents(classId, q);
      setAvailable(data || []);
    } catch (e) {
      setErr(e?.message || "Nepodařilo se načíst dostupné studenty.");
    }
  }

  useEffect(() => {
    if (open) {
      loadStudents();
      loadAvailable("");
      setSearch("");
      setPwOpenFor(null);
      setNewPw("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  function resetCreateForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
  }

  async function handleRemove(studentId) {
    const ok = window.confirm("Opravdu chceš tohoto studenta odebrat ze třídy?");
    if (!ok) return;

    setLoading(true);
    setErr("");
    try {
      await removeStudent(classId, studentId);
      await loadStudents();
      await loadAvailable(search);
      onChanged?.();
    } catch (e) {
      setErr(e?.message || "Nepodařilo se odebrat studenta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAndEnroll(e) {
    e.preventDefault();
    setErr("");

    if (!firstName.trim() || !lastName.trim()) {
      setErr("Jméno a příjmení jsou povinné.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setErr("Heslo musí mít 8–72 znaků.");
      return;
    }

    setLoading(true);
    try {
      await createAndEnrollStudent(classId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        password,
      });

      resetCreateForm();
      await loadStudents();
      await loadAvailable(search);
      onChanged?.();
    } catch (e2) {
      setErr(e2?.message || "Nepodařilo se přidat studenta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrollExisting(studentId) {
    setLoading(true);
    setErr("");
    try {
      await addExistingStudent(classId, studentId);
      await loadStudents();
      await loadAvailable(search);
      onChanged?.();
    } catch (e) {
      setErr(e?.message || "Nepodařilo se zapsat studenta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(studentId) {
    setErr("");
    if (newPw.length < 8 || newPw.length > 72) {
      setErr("Heslo musí mít 8–72 znaků.");
      return;
    }

    setLoading(true);
    try {
      await setStudentPassword(classId, studentId, { password: newPw });
      setPwOpenFor(null);
      setNewPw("");
    } catch (e) {
      setErr(e?.message || "Nepodařilo se změnit heslo.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ světlé/glass styly (ladí s tcd designem)
  const styles = {
    section: {
      padding: 14,
      borderRadius: 18,
      border: "1px solid rgba(90,120,255,0.18)",
      background: "rgba(255,255,255,0.72)",
      boxShadow:
        "0 14px 28px rgba(26,52,160,0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
      backdropFilter: "blur(10px)",
      marginBottom: 12,
      color: "rgba(35,36,58,0.92)",
    },
    h2: { margin: 0, marginBottom: 10, fontSize: 18, fontWeight: 900, color: "rgba(35,36,58,0.85)" },
    label: { display: "block", fontSize: 12, color: "rgba(35,36,58,0.65)", marginBottom: 6, fontWeight: 800 },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(120,130,180,0.22)",
      background: "rgba(255,255,255,0.78)",
      color: "rgba(35,36,58,0.92)",
      outline: "none",
      boxSizing: "border-box",
      boxShadow: "0 10px 18px rgba(60,80,190,0.08)",
    },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },

    btn: {
      padding: "10px 12px",
      borderRadius: 12,
      border: 0,
      background: "linear-gradient(90deg, #3f6bff, #6a5cff)",
      color: "#fff",
      cursor: "pointer",
      minWidth: 108,
      fontWeight: 900,
      boxShadow: "0 16px 26px rgba(63,107,255,0.22)",
      whiteSpace: "nowrap",
    },
    btnSmall: {
      padding: "8px 10px",
      borderRadius: 12,
      border: "1px solid rgba(130,140,190,0.30)",
      background: "rgba(255,255,255,0.65)",
      color: "rgba(35,36,58,0.78)",
      cursor: "pointer",
      fontWeight: 900,
      whiteSpace: "nowrap",
      boxShadow: "0 10px 18px rgba(60,80,190,0.10)",
    },
    btnDanger: {
      padding: "8px 10px",
      borderRadius: 999,
      border: 0,
      background: "linear-gradient(90deg, #ff7aa8, #ff6a8a)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: 900,
      whiteSpace: "nowrap",
    },

    table: { width: "100%", borderCollapse: "collapse" },
    theadTr: { borderBottom: "1px solid rgba(120,130,180,0.18)" },
    th: {
      textAlign: "left",
      padding: "10px 6px",
      fontSize: 12,
      color: "rgba(35,36,58,0.55)",
      fontWeight: 900,
    },
    tr: { borderTop: "1px solid rgba(120,130,180,0.12)" },
    td: { padding: "10px 6px", verticalAlign: "middle", fontSize: 14, color: "rgba(35,36,58,0.78)" },

    scrollBox: {
      marginTop: 10,
      maxHeight: 170,
      overflowY: "auto",
      borderRadius: 14,
      border: "1px solid rgba(120,130,180,0.18)",
      background: "rgba(255,255,255,0.55)",
    },

    muted: { color: "rgba(35,36,58,0.55)", fontSize: 12 },
    error: {
      marginTop: 10,
      padding: 10,
      borderRadius: 14,
      border: "1px solid rgba(255,120,120,0.35)",
      background: "rgba(255,230,230,0.75)",
      color: "rgba(150,20,20,0.95)",
      fontSize: 13,
      fontWeight: 800,
    },
  };

  return (
    <Modal open={open} onClose={onClose} title="Studenti">
      {/* CURRENT STUDENTS */}
      <div style={styles.section}>
        <h2 style={styles.h2}>
          Aktuální studenti <span style={styles.muted}>({students.length})</span>
        </h2>

        {loading && <div style={styles.muted}>Načítám…</div>}

        {!loading && students.length === 0 && (
          <div style={styles.muted}>Zatím tu nejsou žádní studenti.</div>
        )}

        {!loading && students.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadTr}>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Jméno</th>
                <th style={styles.th}>Příjmení</th>
                <th style={styles.th}>E-mail</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Akce</th>
              </tr>
            </thead>

            <tbody>
              {students.map((s) => (
                <tr key={s.id} style={styles.tr}>
                  <td style={styles.td}>{s.id}</td>
                  <td style={styles.td}>{s.first_name || "—"}</td>
                  <td style={styles.td}>{s.last_name || "—"}</td>
                  <td style={styles.td}>{s.email || "bez e-mailu"}</td>

                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        style={styles.btnSmall}
                        type="button"
                        disabled={loading}
                        onClick={() => setPwOpenFor((prev) => (prev === s.id ? null : s.id))}
                      >
                        🔑 Heslo
                      </button>

                      <button
                        style={styles.btnDanger}
                        type="button"
                        disabled={loading}
                        onClick={() => handleRemove(s.id)}
                      >
                        Odebrat
                      </button>
                    </div>

                    {pwOpenFor === s.id && (
                      <div style={{ marginTop: 10 }}>
                        <div style={styles.label}>Nové heslo (8–72)</div>
                        <input
                          style={styles.input}
                          type="password"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Zadej nové heslo"
                          maxLength={72}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                          <button
                            style={styles.btnSmall}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              setPwOpenFor(null);
                              setNewPw("");
                            }}
                          >
                            Zrušit
                          </button>

                          <button
                            style={styles.btn}
                            type="button"
                            disabled={loading}
                            onClick={() => handleSetPassword(s.id)}
                          >
                            Uložit
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {err && <div style={styles.error}>{err}</div>}
      </div>

      {/* AVAILABLE STUDENTS (NOT ENROLLED) */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Přidat existujícího studenta</h2>

        <div style={styles.label}>Hledat (jméno / příjmení / e-mail / user ID)</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            style={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="např. Novák, student@email.cz nebo 14"
            maxLength={100}
          />
          <button style={styles.btn} type="button" disabled={loading} onClick={() => loadAvailable(search)}>
            🔎 Hledat
          </button>
        </div>

        {!loading && available.length === 0 && (
          <div style={{ marginTop: 10, ...styles.muted }}>Žádní dostupní studenti.</div>
        )}

        {!loading && available.length > 0 && (
        <div className="gaScroll" style={styles.scrollBox}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.theadTr}>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Jméno</th>
                  <th style={styles.th}>Příjmení</th>
                  <th style={styles.th}>E-mail</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Akce</th>
                </tr>
              </thead>

              <tbody>
                {available.map((s) => (
                  <tr key={s.id} style={styles.tr}>
                    <td style={styles.td}>{s.id}</td>
                    <td style={styles.td}>{s.first_name || "—"}</td>
                    <td style={styles.td}>{s.last_name || "—"}</td>
                    <td style={styles.td}>{s.email || "bez e-mailu"}</td>

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.btnSmall} type="button" disabled={loading} onClick={() => handleEnrollExisting(s.id)}>
                        ➕ Zapsat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE + ENROLL */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Vytvořit a zapsat nového studenta</h2>
        <div style={{ marginTop: 10, ...styles.muted }}>
          Před vytvořením se ujisti, že tento student ještě nemá účet. Pokud ano, můžete ho jednoduše zapsat pomocí předchozího formuláře. 
        </div>

        <form onSubmit={handleCreateAndEnroll}>
          <div style={styles.row2}>
            <div>
              <div style={styles.label}>Jméno *</div>
              <input
                style={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Např. Jan"
                maxLength={100}
              />
            </div>
            <div>
              <div style={styles.label}>Příjmení *</div>
              <input
                style={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Např. Novák"
                maxLength={100}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.label}>E-mail (volitelné)</div>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@email.cz"
              maxLength={255}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.label}>Heslo *</div>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8–72 znaků"
              maxLength={72}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button style={styles.btn} disabled={loading} type="submit">
              ➕ Vytvořit a zapsat
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
