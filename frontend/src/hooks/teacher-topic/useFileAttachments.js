import { useMemo, useRef, useState } from "react";
import { ALLOWED_UPLOAD_TYPES, isImageFile, isPdfFile } from "../../utils/fileValidation";

export function useFileAttachments(setError) {
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const allowed = useMemo(() => ALLOWED_UPLOAD_TYPES, []);

  function onFilesChange(e) {
    setError("");
    const selected = Array.from(e.target.files || []);

    if (selected.length > 3) {
      setError("Maximální počet souborů je 3.");
      e.target.value = "";
      setFiles([]);
      return;
    }

    const bad = selected.find(
      (f) => !allowed.has((f.type || "").toLowerCase()) && !isPdfFile(f) && !isImageFile(f)
    );
    if (bad) {
      setError(`Nepodporovaný typ souboru: ${bad.name} (${bad.type || "unknown"}).`);
      e.target.value = "";
      setFiles([]);
      return;
    }

    setFiles(selected);
  }

  function removeFileAt(idx) {
    setError("");
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearFiles() {
    setError("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return { files, setFiles, fileInputRef, onFilesChange, removeFileAt, clearFiles };
}
