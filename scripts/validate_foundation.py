"""Validate repository JSON, internal Markdown links, and example references.
This is a repository structure check, not an application or hardware test.
"""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for path in root.rglob('*.json'):
    if not set(path.parts) & {'.git', '.local', 'node_modules', 'dist', 'target', 'release-local'}:
        json.loads(path.read_text(encoding='utf-8'))
for path in root.rglob('*.md'):
    if set(path.parts) & {'.git', '.local', 'node_modules', 'dist', 'target', 'release-local'}:
        continue
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        if '://' not in target and not target.startswith('#'):
            assert (path.parent / target.split('#')[0]).exists(), (path, target)
profile = json.loads((root / 'examples/profile.example.json').read_text(encoding='utf-8'))
assert profile['schemaVersion'] == 1
device_ids = {d['id'] for d in profile['devices']}
assert len(device_ids) == len(profile['devices'])
for group in profile['groups']:
    assert set(group['deviceIds']) <= device_ids
scene_ids = {s['id'] for s in profile['scenes']}
for scene in profile['scenes']:
    assert all(t['deviceId'] in device_ids for t in scene['targets'])
for slot in profile['quickSlots']:
    assert slot['sceneId'] is None or slot['sceneId'] in scene_ids
print('Foundation checks passed: JSON, documentation links, example references.')
