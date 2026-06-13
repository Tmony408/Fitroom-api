import { Controller, Get, Header } from '@nestjs/common';

/**
 * Serves the embeddable widget. Partners add:
 *   <script src="https://<api>/api/widget.js" data-key="pk_live_..."></script>
 *   <button class="fitroom-btn"
 *     data-category="Senator" data-stretch="LOW"
 *     data-chart='{"sizes":["S","M","L"],"chest":[96,100,104],"waist":[84,88,92]}'>
 *     Get my size
 *   </button>
 * Clicking opens a modal, asks the shopper for chest/waist/fit, calls
 * /b2b/fit-check with the publishable key, and shows the recommended size.
 */
@Controller('widget.js')
export class WidgetController {
  @Get()
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  serve(): string {
    return WIDGET_JS;
  }
}

const WIDGET_JS = `(function(){
  var script = document.currentScript;
  var KEY = script && script.getAttribute('data-key');
  var API = (function(){ try { var u = new URL(script.src); return u.origin + '/api'; } catch(e){ return ''; } })();
  if(!KEY){ console.warn('[FitRoom] missing data-key'); return; }

  var css = '.fr-modal{position:fixed;inset:0;background:rgba(8,6,14,.6);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:-apple-system,Segoe UI,Roboto,sans-serif}'
    +'.fr-card{background:#fff;color:#16121e;max-width:360px;width:92%;border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4)}'
    +'.fr-card h3{margin:0 0 4px;font-size:18px}.fr-card p{margin:0 0 14px;color:#6b6480;font-size:13px}'
    +'.fr-row{display:flex;gap:10px}.fr-row>div{flex:1}'
    +'.fr-card label{display:block;font-size:12px;color:#6b6480;margin:8px 0 4px;font-weight:600}'
    +'.fr-card input,.fr-card select{width:100%;padding:9px;border:1px solid #e3e0ea;border-radius:9px;font-size:14px;box-sizing:border-box}'
    +'.fr-btn{margin-top:14px;width:100%;background:linear-gradient(120deg,#fb7427,#ec4899,#8b5cf6);color:#fff;border:none;padding:11px;border-radius:11px;font-weight:700;cursor:pointer;font-size:14px}'
    +'.fr-x{float:right;cursor:pointer;color:#9b93ad;border:none;background:none;font-size:18px}'
    +'.fr-res{margin-top:14px;padding:14px;border-radius:12px;background:#faf7ff;text-align:center}'
    +'.fr-size{font-size:30px;font-weight:800}.fr-warn{margin-top:8px;font-size:12px;color:#b26a00}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function openModal(cfg){
    var ov = document.createElement('div'); ov.className='fr-modal';
    ov.innerHTML = '<div class="fr-card"><button class="fr-x">&times;</button>'
      +'<h3>Find your size</h3><p>Enter your measurements for a personalised fit.</p>'
      +'<div class="fr-row"><div><label>Chest (cm)</label><input id="fr-chest" type="number" value="100"></div>'
      +'<div><label>Waist (cm)</label><input id="fr-waist" type="number" value="90"></div></div>'
      +'<label>Fit preference</label><select id="fr-pref"><option>regular</option><option>tight</option><option>relaxed</option><option>oversized</option></select>'
      +'<button class="fr-btn" id="fr-go">Get my size</button><div id="fr-out"></div></div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    ov.querySelector('.fr-x').onclick = close;
    ov.onclick = function(e){ if(e.target===ov) close(); };
    ov.querySelector('#fr-go').onclick = function(){
      var out = ov.querySelector('#fr-out');
      out.innerHTML = '<p style="text-align:center">Checking…</p>';
      fetch(API + '/b2b/fit-check', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':KEY},
        body: JSON.stringify({
          category: cfg.category, stretch: cfg.stretch, sizeChart: cfg.chart,
          chest: Number(ov.querySelector('#fr-chest').value),
          waist: Number(ov.querySelector('#fr-waist').value),
          fitPreference: ov.querySelector('#fr-pref').value,
          productRef: cfg.product
        })
      }).then(function(r){ if(!r.ok) throw new Error('fit-check failed'); return r.json(); })
        .then(function(d){
          var warn = (d.warnings||[]).map(function(w){return '<div class="fr-warn">⚠️ '+w+'</div>';}).join('');
          out.innerHTML = '<div class="fr-res"><div style="font-size:12px;color:#6b6480">Recommended size</div>'
            +'<div class="fr-size">'+d.recommendedSize+'</div>'
            +'<div style="font-size:12px;color:#6b6480">'+d.fitConfidence+'% confidence</div>'+warn
            +(d.alternativeSize?'<div style="margin-top:6px;font-size:12px">Alt: '+d.alternativeSize+'</div>':'')+'</div>';
        }).catch(function(){ out.innerHTML = '<p style="color:#c0392b;text-align:center">Could not get your size. Check the key/domain.</p>'; });
    };
  }

  function parse(btn){
    var chart; try { chart = JSON.parse(btn.getAttribute('data-chart')||'null'); } catch(e){ chart=null; }
    return { category: btn.getAttribute('data-category')||'Senator', stretch: btn.getAttribute('data-stretch')||'LOW',
      product: btn.getAttribute('data-product')||null, chart: chart };
  }
  function bind(){
    document.querySelectorAll('.fitroom-btn').forEach(function(btn){
      if(btn.__fr) return; btn.__fr = true;
      btn.addEventListener('click', function(e){ e.preventDefault(); var c=parse(btn); if(!c.chart){ console.warn('[FitRoom] data-chart missing'); return; } openModal(c); });
    });
  }
  if(document.readyState!=='loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
  window.FitRoom = { bind: bind };
})();`;
