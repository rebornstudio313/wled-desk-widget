from pathlib import Path
import tomllib,json,re,shutil
root=Path(__file__).resolve().parents[1]
rows=[];missing=[]
license_root=root/'docs/licenses';license_root.mkdir(parents=True,exist_ok=True)
def gather(kind,name,version,license_name,folder):
 safe=re.sub(r'[^a-zA-Z0-9_.-]','_',name)+'-'+version
 files=[]
 for file in folder.iterdir():
  if file.is_file() and re.match(r'^(licen[sc]e|copying|notice|copyright)([._-]|$)',file.name,re.I):
   dest=license_root/kind/safe/file.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,dest);files.append(dest.relative_to(root).as_posix())
 rows.append({'ecosystem':kind,'name':name,'version':version,'license':license_name or 'UNKNOWN','files':files})
 if not license_name or not files:missing.append(f'{kind}: {name} {version}')
lock=tomllib.loads((root/'apps/desktop/src-tauri/Cargo.lock').read_text(encoding='utf-8'))
registries=list((root/'.local/toolchain/cargo/registry/src').glob('*'))
for pkg in lock['package']:
 if 'source' not in pkg:continue
 folder=next((r/(pkg['name']+'-'+pkg['version']) for r in registries if (r/(pkg['name']+'-'+pkg['version'])/'Cargo.toml').exists()),None)
 if folder:
  data=tomllib.loads((folder/'Cargo.toml').read_text(encoding='utf-8'))['package'];gather('rust',pkg['name'],pkg['version'],data.get('license'),folder)
 else:missing.append('rust source missing: '+pkg['name']+' '+pkg['version'])
seen=set()
for manifest in (root/'node_modules/.pnpm').glob('*/node_modules/**/package.json'):
 # Only package roots, not vendored examples or test manifests.
 rel=manifest.relative_to(root/'node_modules/.pnpm').parts
 if len(rel) not in (4,5) or len(rel)==5 and not rel[2].startswith('@'):continue
 try:data=json.loads(manifest.read_text(encoding='utf-8'))
 except (ValueError,OSError):continue
 name=data.get('name');version=data.get('version')
 if not name or not version or (name,version) in seen:continue
 seen.add((name,version));value=data.get('license');value=value if isinstance(value,str) else json.dumps(value) if value else None
 gather('npm',name,version,value,manifest.parent)
rows.sort(key=lambda r:(r['ecosystem'],r['name'],r['version']))
(root/'docs/DEPENDENCY-LICENSES.json').write_text(json.dumps({'packages':rows,'needsReview':missing},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Лицензии зависимостей','','Автоматический инвентарь по локальным пакетам и Cargo.lock. Включает зависимости','разработки и всех платформ; это не утверждение, что каждый пакет входит в EXE.','Тексты upstream сохранены в `docs/licenses` относительно корня репозитория.','','| Экосистема | Пакет | Версия | Лицензия |','|---|---|---|---|']
for r in rows:lines.append('| '+ ' | '.join([r['ecosystem'],r['name'],r['version'],r['license'].replace('|',' / ')])+' |')
lines+=['','## Проверить вручную','']+[f'- {name}' for name in missing]
(root/'docs/DEPENDENCY-LICENSES.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(f'License inventory: {len(rows)} packages; manual review: {len(missing)}')
