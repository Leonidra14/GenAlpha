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

  const [available, setAvailable] = useState([]);
  const [search, setSearch] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      const res = await createAndEnrollStudent(classId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        password,
      });

      const lk = res?.student?.login_key;
      if (lk) {
        window.alert(
          `Student byl vytvořen.\n\nPřihlašovací jméno pro žáka: ${lk}\n\n(Ulož si ho nebo ho předej žákovi.)`,
        );
      }

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

  return (
    <Modal open={open} onClose={onClose} title="Studenti">
      <div className="gaModalSection">
        <h2 className="gaModalSectionTitle">
          Aktuální studenti <span className="gaModalMuted">({students.length})</span>
        </h2>

        {loading && <div className="gaModalMuted">Načítám…</div>}

        {!loading && students.length === 0 && (
          <div className="gaModalMuted">Zatím tu nejsou žádní studenti.</div>
        )}

        {!loading && students.length > 0 && (
          <table className="gaModalTable">
            <thead>
              <tr>
                <th className="gaModalTh">ID</th>
                <th className="gaModalTh">Jméno</th>
                <th className="gaModalTh">Příjmení</th>
                <th className="gaModalTh">Přihlášení</th>
                <th className="gaModalTh">E-mail</th>
                <th className="gaModalTh gaModalThRight">Akce</th>
              </tr>
            </thead>

            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="gaModalTr">
                  <td className="gaModalTd">{s.id}</td>
                  <td className="gaModalTd">{s.first_name || "—"}</td>
                  <td className="gaModalTd">{s.last_name || "—"}</td>
                  <td className="gaModalTd gaModalTdMono">{s.login_key || "—"}</td>
                  <td className="gaModalTd">{s.email || "bez e-mailu"}</td>

                  <td className="gaModalTd gaModalTdRight">
                    <div className="gaModalTableActions">
                      <button
                        className="tcdBtn compact"
                        type="button"
                        disabled={loading}
                        onClick={() => setPwOpenFor((prev) => (prev === s.id ? null : s.id))}
                      >
                        🔑 Heslo
                      </button>

                      <button
                        className="tcdBtn pillDanger compact"
                        type="button"
                        disabled={loading}
                        onClick={() => handleRemove(s.id)}
                      >
                        Odebrat
                      </button>
                    </div>

                    {pwOpenFor === s.id && (
                      <div className="gaModalPwBlock">
                        <div className="gaModalLabel">Nové heslo (8–72)</div>
                        <input
                          className="gaModalInput"
                          type="password"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Zadej nové heslo"
                          maxLength={72}
                        />
                        <div className="gaModalPwActions">
                          <button
                            className="tcdBtn compact"
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
                            className="tcdBtn primary compact"
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

        {err && <div className="gaModalError">{err}</div>}
      </div>

      <div className="gaModalSection">
        <h2 className="gaModalSectionTitle">Přidat existujícího studenta</h2>

        <div className="gaModalLabel">Hledat (jméno / příjmení / přihlášení / e-mail / user ID)</div>
        <div className="gaModalSearchRow">
          <input
            className="gaModalInput"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="např. Novák, student@email.cz nebo 14"
            maxLength={100}
          />
          <button
            className="tcdBtn primary"
            type="button"
            disabled={loading}
            onClick={() => loadAvailable(search)}
          >
            🔎 Hledat
          </button>
        </div>

        {!loading && available.length === 0 && (
          <div className="gaModalHint">Žádní dostupní studenti.</div>
        )}

        {!loading && available.length > 0 && (
          <div className="gaModalScrollBox">
            <table className="gaModalTable">
              <thead>
                <tr>
                  <th className="gaModalTh">ID</th>
                  <th className="gaModalTh">Jméno</th>
                  <th className="gaModalTh">Příjmení</th>
                  <th className="gaModalTh">Přihlášení</th>
                  <th className="gaModalTh">E-mail</th>
                  <th className="gaModalTh gaModalThRight">Akce</th>
                </tr>
              </thead>

              <tbody>
                {available.map((s) => (
                  <tr key={s.id} className="gaModalTr">
                    <td className="gaModalTd">{s.id}</td>
                    <td className="gaModalTd">{s.first_name || "—"}</td>
                    <td className="gaModalTd">{s.last_name || "—"}</td>
                    <td className="gaModalTd gaModalTdMono">{s.login_key || "—"}</td>
                    <td className="gaModalTd">{s.email || "bez e-mailu"}</td>

                    <td className="gaModalTd gaModalTdRight">
                      <button
                        className="tcdBtn compact"
                        type="button"
                        disabled={loading}
                        onClick={() => handleEnrollExisting(s.id)}
                      >
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

      <div className="gaModalSection">
        <h2 className="gaModalSectionTitle">Vytvořit a zapsat nového studenta</h2>
        <div className="gaModalHint">
          Před vytvořením se ujisti, že tento student ještě nemá účet. Pokud ano, můžete ho jednoduše zapsat
          pomocí předchozího formuláře. Přihlašovací jméno žáka vznikne z příjmení (bez háčků, malá písmena) a
          čísla ID účtu, např. koroptvicka15.
        </div>

        <form onSubmit={handleCreateAndEnroll}>
          <div className="gaModalRow2">
            <div>
              <div className="gaModalLabel">Jméno *</div>
              <input
                className="gaModalInput"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Např. Jan"
                maxLength={100}
              />
            </div>
            <div>
              <div className="gaModalLabel">Příjmení *</div>
              <input
                className="gaModalInput"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Např. Novák"
                maxLength={100}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="gaModalFieldGap">
            <div className="gaModalLabel">E-mail (volitelné)</div>
            <input
              className="gaModalInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@email.cz"
              maxLength={255}
            />
          </div>

          <div className="gaModalFieldGap">
            <div className="gaModalLabel">Heslo *</div>
            <input
              className="gaModalInput"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8–72 znaků"
              maxLength={72}
            />
          </div>

          <div className="gaModalActionsSpaced">
            <button className="tcdBtn primary" disabled={loading} type="submit">
              ➕ Vytvořit a zapsat
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
