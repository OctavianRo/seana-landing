"""Build only public assets; never package repository metadata or configuration secrets."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parent.parent
out = root / "dist"
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ("index.html", "styles.css", "main.js", "favicon.svg", "assets", "portal", "privacy", "cookies", "screenshots"):
    source = root / name
    if source.is_dir(): shutil.copytree(source, out / name)
    elif source.is_file(): shutil.copy2(source, out / name)
print("Static site built in dist")
