const form = document.getElementById("form");
const fileEl = document.getElementById("file");
const statusEl = document.getElementById("status");
const downloadEl = document.getElementById("download");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fileEl.files[0]) return;

  statusEl.textContent = "Conversion…";
  downloadEl.classList.add("hidden");

  const fd = new FormData();
  fd.append("file", fileEl.files[0]);

  const res = await fetch("/convert", { method: "POST", body: fd }); 
  if (!res.ok) {
    let msg = "Erreur";
    try { const err = await res.json(); msg = err.details || err.error || msg; } catch {}
    statusEl.textContent = msg;
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  downloadEl.href = url;
  downloadEl.download = (fileEl.files[0].name.replace(/\.[^.]+$/, "") || "document") + ".pdf";
  downloadEl.classList.remove("hidden");
  statusEl.textContent = "Terminé";
});
