# Run a real Firefox with an isolated temporary profile and local test page.
import http.server, json, pathlib, shutil, subprocess, tempfile, threading, time, os, signal
root = pathlib.Path(__file__).resolve().parent.parent
firefox = os.environ.get('FIREFOX_BINARY') or ('/snap/firefox/current/usr/lib/firefox/firefox' if pathlib.Path('/snap/firefox/current/usr/lib/firefox/firefox').exists() else 'firefox')
result = threading.Event()
reports = []
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        print('Local test page requested', flush=True); self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
        self.wfile.write((root/'tests'/'fixtures'/'facebook.html').read_bytes())
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        reports.append(body)
        print(json.dumps(body), flush=True)
        self.send_response(200); self.end_headers()
        if body.get('type') in ('PASS', 'FAIL'): result.set()
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
# Test the packaged build, using the repository's pinned web-ext and Node.
bin_dir = root/'node_modules'/'.bin'
env = {**os.environ, 'PATH': f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"}
subprocess.run(['node', str(root/'scripts'/'build.mjs'), 'firefox'], check=True, env=env)
web_ext = str(bin_dir/'web-ext') if (bin_dir/'web-ext').exists() else 'web-ext'
with tempfile.TemporaryDirectory(prefix='ff-timer-') as temp:
    src = pathlib.Path(temp)/'extension'
    shutil.copytree(root/'dist'/'firefox', src)
    manifest = json.loads((src/'manifest.json').read_text())
    endpoint = f'http://127.0.0.1:{server.server_port}/'
    manifest['host_permissions'].append(endpoint+'*')
    manifest['background']['scripts'] = ['capture.js'] + manifest['background']['scripts'] + ['verify.js']
    manifest['content_scripts'][0]['js'].insert(0, 'page-capture.js')
    (src/'page-capture.js').write_text("const originalLog = console.log.bind(console); console.log = (...args) => { originalLog(...args); browser.runtime.sendMessage({type:'page-console',args}); };")
    (src/'manifest.json').write_text(json.dumps(manifest))
    (src/'capture.js').write_text('''
const report = value => fetch(ENDPOINT, {method:'POST', body:JSON.stringify(value)}).catch(()=>{});
browser.runtime.onMessage.addListener(message => { if (message.type === 'page-console') report(message); });
for (const level of ['log','info','error','warn']) {
 const original = console[level].bind(console);
 console[level] = (...args) => { original(...args); report({type:'console',level,args:args.map(x=>x instanceof Error ? String(x) : x)}); };
}
addEventListener('error', e => report({type:'FAIL', error:e.message}));
addEventListener('unhandledrejection', e => report({type:'FAIL', error:String(e.reason)}));
'''.replace('ENDPOINT',json.dumps(endpoint)))
    (src/'verify.js').write_text('''
(async () => {
 try {
  await new Promise(r=>setTimeout(r,1000));
  await scheduleUpdate();
  await report({type:'startup',usage:(await browser.storage.local.get('usage')).usage});
  // Navigate the startup tab: Firefox 154 leaves a tab created by tabs.create
  // in the background here even with active:true.
  const [current] = await browser.tabs.query({active:true, lastFocusedWindow:true});
  const tab = await browser.tabs.update(current.id, {url:FACEBOOK_URL});
  await browser.windows.update(tab.windowId,{focused:true});
  await new Promise(r=>setTimeout(r,2000));
  await browser.storage.local.set({dailyLimitMinutes:1,usage:{day:dayKey(Date.now()),elapsed:50000,since:null}});
  await scheduleUpdate();
  const before = (await browser.storage.local.get('usage')).usage;
  if (!before.since) throw new Error('Timer did not start: '+JSON.stringify(before));
  await report({type:'counting',usage:before,alarm:await browser.alarms.get('usage-limit')});
  await new Promise(r=>setTimeout(r,3000));
  await scheduleUpdate();
  const after = (await browser.storage.local.get('usage')).usage;
  if (after.elapsed < 52500) throw new Error('Usage did not increase: '+JSON.stringify(after));
  await report({type:'increased',usage:after});
  for (let i=0;i<60;i++) {
   await new Promise(r=>setTimeout(r,1000));
   const current = await browser.tabs.get(tab.id);
   if (current.url===browser.runtime.getURL('block.html')) {
    await report({type:'PASS',message:'Real Firefox: background started, countdown increased usage, alarm redirected Facebook',usage:(await browser.storage.local.get('usage')).usage});
    return;
   }
  }
  throw new Error('No automatic redirect by deadline');
 } catch (e) { await report({type:'FAIL',error:String(e),stack:e.stack}); }
})();
'''.replace('FACEBOOK_URL', json.dumps(f'http://facebook.com:{server.server_port}/')))
    log = open(pathlib.Path(temp)/'browser.log','w')
    proc = subprocess.Popen([web_ext,'run','--source-dir',str(src),'--firefox',firefox,'--no-reload','--no-input','--pref=network.dns.localDomains=facebook.com','--pref=dom.security.https_first=false','--pref=network.stricttransportsecurity.preloadlist=false','--args=-headless'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env=env)
    try:
        finished = result.wait(90)
        if not finished:
            print('FAIL: timed out; browser log:',flush=True)
            print(pathlib.Path(log.name).read_text(),flush=True)
    finally:
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=15)
        server.shutdown()
    if not any(r.get('type')=='PASS' for r in reports): raise SystemExit(1)
    if not any(r.get('type')=='page-console' for r in reports):
        print('FAIL: no page-console messages received'); raise SystemExit(1)
