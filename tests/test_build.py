import io
import json
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class BuildTest(unittest.TestCase):
    def test_ipk_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            shutil.copy(ROOT / 'build.py', root)
            shutil.copytree(ROOT / 'app', root / 'app')
            subprocess.run([sys.executable, str(root / 'build.py')], check=True)
            info = json.loads((root / 'app/appinfo.json').read_text())
            package = root / f'{info["id"]}_{info["version"]}_all.ipk'
            raw = package.read_bytes()
            self.assertEqual(raw[:8], b'!<arch>\n')
            members = {}
            offset = 8
            while offset < len(raw):
                header = raw[offset:offset + 60]
                self.assertEqual(header[58:60], b'`\n')
                size = int(header[48:58])
                name = header[:16].decode().strip()
                offset += 60
                members[name] = raw[offset:offset + size]
                offset += size + size % 2
            self.assertEqual(set(members), {
                'debian-binary', 'control.tar.gz', 'data.tar.gz',
            })
            self.assertEqual(members['debian-binary'], b'2.0\n')
            with tarfile.open(fileobj=io.BytesIO(members['control.tar.gz'])) as tar:
                member = tar.extractfile('control')
                assert member is not None
                control = member.read().decode()
                self.assertIn('Version: ' + info['version'] + '\n', control)
                self.assertIn('Package: ' + info['id'] + '\n', control)
            with tarfile.open(fileobj=io.BytesIO(members['data.tar.gz'])) as tar:
                base = 'usr/palm/applications/' + info['id'] + '/'
                for source in (root / 'app').rglob('*'):
                    if source.is_file():
                        name = base + source.relative_to(root / 'app').as_posix()
                        member = tar.extractfile(name)
                        assert member is not None
                        self.assertEqual(member.read(), source.read_bytes())


if __name__ == '__main__':
    unittest.main()
