"""Bygger ENDAST för en tom, isolerad utvecklingsprofil. Installeras aldrig i vanlig profil.
Testtillägget skapar fiktiva mejl/mappar och återställer Läsfilters egna testinställningar.
"""
from pathlib import Path
import zipfile,json,sys
ROOT=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/lasfilter-native-check.xpi')
if not str(out.resolve()).startswith('/tmp/'):
    raise SystemExit('Testbygget måste ligga under /tmp. Det får inte förväxlas med leveransen.')
r=ROOT/'addon';m=json.loads((r/'manifest.json').read_text());m['version']='1.0.3';m['name']='Läsfilter – ENDAST ISOLERAT TEST'
m['permissions']+=['accountsFolders','messagesImport','messagesUpdate','windows'];m['background']['scripts']+=['native-driver.js']
d=(ROOT/'tester/native-driver.js').read_text().replace(" await browser.tabs.create({url:browser.runtime.getURL('native-result.html')", " dump('LF_RELEASE_NATIVE '+JSON.stringify(data)+'\\n');\n await browser.tabs.create({url:browser.runtime.getURL('native-result.html')")
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for p in r.iterdir():
        if not p.is_file() or p.name=='manifest.json':continue
        if p.name=='ui.html':z.writestr(p.name,p.read_text().replace('</body>','<script src="native-ui.js"></script></body>'))
        else:z.write(p,p.name)
    z.writestr('manifest.json',json.dumps(m));z.writestr('native-driver.js',d)
    z.write(ROOT/'tester/native-ui.js','native-ui.js');z.writestr('native-result.html','<!doctype html><title>Native results</title>Resultat i fragmentet.')
print(out)
