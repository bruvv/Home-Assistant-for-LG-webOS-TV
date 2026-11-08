#!/usr/bin/env python3
"""Build a self-contained webOS TV IPK from the app/ directory (Python 3 stdlib only)."""
import io
import json
import pathlib
import tarfile
import time

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / 'app'
INFO = json.loads((APP / 'appinfo.json').read_text('utf-8'))
APP_ID = INFO['id']
VERSION = INFO['version']
OUT = ROOT / f'{APP_ID}_{VERSION}_all.ipk'


def tar_gz(items):
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode='w:gz', format=tarfile.GNU_FORMAT) as archive:
        for name, contents in items:
            meta = tarfile.TarInfo(name)
            meta.uid = meta.gid = 0
            meta.mtime = int(time.time())
            if contents is None:
                meta.type = tarfile.DIRTYPE
                meta.mode = 0o755
                archive.addfile(meta)
            else:
                meta.mode = 0o644
                meta.size = len(contents)
                archive.addfile(meta, io.BytesIO(contents))
    return result.getvalue()


def ar_archive(items):
    out = io.BytesIO()
    out.write(b'!<arch>\n')
    for name, contents in items:
        header = '%-16s%-12d%-6d%-6d%-8s%-10d`\n' % (
            name, int(time.time()), 0, 0, '100644', len(contents))
        out.write(header.encode('ascii'))
        out.write(contents)
        if len(contents) % 2:
            out.write(b'\n')
    return out.getvalue()


base = 'usr/palm/applications/' + APP_ID
entries = [(dir_name, None) for dir_name in (
    'usr', 'usr/palm', 'usr/palm/applications', base,
)]
app_files = sorted(p for p in APP.rglob('*') if p.is_file())
for file in app_files:
    path = file.relative_to(APP).as_posix()
    entries.append((base + '/' + path, file.read_bytes()))

package = json.dumps({'id': APP_ID, 'version': VERSION, 'app': APP_ID}, indent=2).encode()
entries.extend([
    ('usr/palm/packages', None),
    ('usr/palm/packages/' + APP_ID, None),
    ('usr/palm/packages/' + APP_ID + '/packageinfo.json', package),
])
size_bytes = sum(p.stat().st_size for p in app_files) + len(package)
control = '\n'.join([
    'Package: ' + APP_ID,
    'Version: ' + VERSION,
    'Section: misc',
    'Priority: optional',
    'Architecture: all',
    'Installed-Size: ' + str(size_bytes),
    'Maintainer: Community',
    'Description: Unofficial Home Assistant launcher for LG webOS TV',
    'webOS-Package-Format-Version: 2',
    'webOS-Packager-Version: 1.0.0',
    '',
]).encode()

OUT.write_bytes(ar_archive([
    ('debian-binary', b'2.0\n'),
    ('control.tar.gz', tar_gz([('control', control)])),
    ('data.tar.gz', tar_gz(entries)),
]))
print(f'Built {OUT} ({OUT.stat().st_size} bytes)')
