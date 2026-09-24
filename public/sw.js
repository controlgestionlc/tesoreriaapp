self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// Financial data is never cached. All writes require a live connection.
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Sin conexión · Tesorería</title><body style="font:18px Arial;padding:40px;color:#123b64"><h1>Sin conexión</h1><p>Conéctate a internet para consultar saldos actualizados y registrar movimientos.</p><button onclick="location.reload()" style="padding:14px">Volver a intentar</button></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})))});
