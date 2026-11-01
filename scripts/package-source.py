"""Build a public source archive from explicit top-level allowlist."""
from pathlib import Path
import zipfile,hashlib,json
root=Path(__file__).resolve().parents[1]
folders=['.github','apps','assets','docs','examples','packages','schemas','scripts','tests']
files=['.editorconfig','.gitattributes','.gitignore','CHANGELOG.md','CONTRIBUTING.md','LICENSE','README.md','README.en.md','SECURITY.md','THIRD_PARTY_NOTICES.md','package.json','pnpm-lock.yaml','rust-toolchain.toml','tsconfig.json','vite.config.ts','Start Widget.cmd']
blocked={'.git','.local','node_modules','target','dist','__pycache__','release-local'}
paths=[root/f for f in files if (root/f).is_file()]
for folder in folders:
 paths.extend(p for p in (root/folder).rglob('*') if p.is_file() and not(set(p.relative_to(root).parts)&blocked))
out=root/'release-local';out.mkdir(exist_ok=True);version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version'];archive=out/f'wled-desk-widget-{version}-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(set(paths)):z.write(p,'wled-desk-widget/'+p.relative_to(root).as_posix())
(out/'SOURCE-SHA256.txt').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(f'Source package: {archive}; files: {len(set(paths))}')
