import hashlib
import json
import pathlib
import tempfile
import unittest

from catalog import make_catalog

ROOT = pathlib.Path(__file__).resolve().parents[1]


class CatalogTest(unittest.TestCase):
    def test_published_package_metadata(self):
        info = json.loads((ROOT / 'app/appinfo.json').read_text())
        with tempfile.TemporaryDirectory() as directory:
            ipk = pathlib.Path(directory) / (
                f'{info["id"]}_{info["version"]}_all.ipk'
            )
            contents = b'!<arch>\nexample package'
            ipk.write_bytes(contents)
            package = make_catalog(info, ipk)['packages'][0]
            manifest = package['manifest']
            self.assertEqual(package['id'], info['id'])
            self.assertEqual(manifest['version'], info['version'])
            self.assertEqual(manifest['ipkSize'], len(contents))
            self.assertEqual(
                manifest['ipkHash']['sha256'],
                hashlib.sha256(contents).hexdigest(),
            )
            self.assertTrue(manifest['ipkUrl'].startswith('https://'))
            self.assertTrue(manifest['ipkUrl'].endswith(
                f'/v{info["version"]}/{ipk.name}',
            ))
            self.assertTrue(manifest['iconUri'].startswith('https://'))
            ipk.write_bytes(b'not an archive')
            with self.assertRaises(ValueError):
                make_catalog(info, ipk)
            with self.assertRaises(ValueError):
                make_catalog(info, ipk.with_name('wrong.ipk'))


if __name__ == '__main__':
    unittest.main()
