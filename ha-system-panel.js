/**
 * HA System Panel for Home Assistant
 * Russian derivative of Pjarbit/supervisor-panel.
 * Original: Copyright (c) 2026 Philip J. Arbit. MIT License.
 */
const HA_SYSTEM_PANEL_VERSION='1.0.0';
class HaSystemPanel extends HTMLElement{
  connectedCallback(){
    this.style.cssText='display:block;height:100%;overflow:auto;background:var(--primary-background-color,#111)';
    this._conn=null;this._lines=[];this._paused=false;this._busy=false;this.render();
    if(typeof hassConnection==='undefined'){this._error('Соединение с Home Assistant недоступно');return}
    hassConnection.then(c=>{this._conn=c.conn;this._load();this._stats=setInterval(()=>this._load(false),30000);this._logs=setInterval(()=>{if(!this._paused)this._loadLogs()},10000)}).catch(e=>this._error(e.message));
  }
  disconnectedCallback(){clearInterval(this._stats);clearInterval(this._logs)}
  async _ws(msg){if(!this._conn)throw new Error('WebSocket не подключён');return this._conn.sendMessagePromise(msg)}
  async _token(){return (await hassConnection).auth.data.access_token}
  async _api(endpoint,json=false){const r=await fetch(`/api/hassio/${endpoint}`,{headers:{Authorization:`Bearer ${await this._token()}`}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return json?(await r.json())?.data??await r.json():r.text()}
  async _safe(endpoint){try{const r=await fetch(`/api/hassio/${endpoint}`,{headers:{Authorization:`Bearer ${await this._token()}`}});if(!r.ok)return null;const j=await r.json();return j?.data??j}catch{return null}}
  render(){this.innerHTML=`
<style>
*{box-sizing:border-box}.page{max-width:1400px;margin:auto;padding:16px;font-family:Roboto,Arial,sans-serif;color:var(--primary-text-color,#fff)}
.head,.loghead,.controls,.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.head{justify-content:space-between;margin-bottom:14px}.title{display:flex;align-items:baseline;gap:12px}.title h1{margin:0;font-size:1.45rem;font-weight:500}.updated{font-size:.78rem;color:var(--secondary-text-color,#999)}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px}.card,.log{background:var(--card-background-color,var(--ha-card-background,#1c1c1c));border:1px solid var(--divider-color,rgba(255,255,255,.1));border-radius:14px;box-shadow:var(--ha-card-box-shadow,0 2px 6px rgba(0,0,0,.22))}.card{padding:16px;display:flex;flex-direction:column;min-height:300px}.card h2,.log h2{margin:0;font-size:1.1rem;font-weight:500}.body{flex:1;margin-top:14px}.row{display:flex;justify-content:space-between;gap:14px;margin-bottom:9px;font-size:.86rem}.label{color:var(--secondary-text-color,#aaa)}.value{text-align:right;font-weight:500}.warn{color:#ff9800}.barwrap{height:7px;margin:-2px 0 12px;background:rgba(127,127,127,.18);border-radius:99px;overflow:hidden}.bar{height:100%;border-radius:99px}.low{background:#4caf50}.mid{background:#ff9800}.high{background:#f44336}.badge{margin-left:6px;padding:2px 7px;border-radius:99px;background:rgba(255,152,0,.18);color:#ffb74d;font-size:.72rem}.actions{margin-top:14px;padding-top:14px;border-top:1px solid var(--divider-color,rgba(255,255,255,.1))}
button,input,select{min-height:34px;border-radius:8px;font:inherit;font-size:.8rem}button{padding:7px 12px;border:1px solid var(--primary-color,#03a9f4);background:transparent;color:var(--primary-color,#03a9f4);cursor:pointer}button:hover{background:rgba(3,169,244,.1)}button.primary{background:var(--primary-color,#03a9f4);color:#fff}button.danger{background:#d32f2f;border-color:#d32f2f;color:#fff}.version{margin-left:auto;color:var(--secondary-text-color,#888);font-size:.68rem}
.log{padding:16px}.loghead{justify-content:space-between;margin-bottom:10px}.controls input,.controls select{padding:6px 9px;border:1px solid var(--divider-color,rgba(255,255,255,.2));background:var(--card-background-color,#1c1c1c);color:var(--primary-text-color,#fff)}.controls input{width:220px}pre{margin:0;min-height:220px;max-height:460px;padding:12px;overflow:auto;border-radius:10px;background:#0b0b0b;color:#d0d0d0;font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word}.err{color:#ef5350}.warning{color:#ffb74d}.hit{background:rgba(255,235,59,.18)}.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:92vw;padding:10px 18px;border-radius:8px;background:#323232;color:#fff;opacity:0;pointer-events:none;transition:.2s}.toast.show{opacity:1}
@media(max-width:900px){.cards{grid-template-columns:1fr}.card{min-height:0}}@media(max-width:560px){.page{padding:10px}.card,.log{padding:13px}.title{display:block}.updated{display:block;margin-top:4px}.controls{width:100%}.controls input{flex:1;width:auto;min-width:130px}}
</style>
<div class="page">
 <div class="head"><div class="title"><h1>Система</h1><span id="updated" class="updated">Подключение…</span></div><button id="refresh" class="primary">↻ Обновить всё</button></div>
 <div class="cards">
  <section class="card"><h2>Home Assistant Core</h2><div id="core" class="body">Загрузка…</div><div class="actions"><button id="restartCore" class="primary">Перезапустить Core</button></div></section>
  <section class="card"><h2>Supervisor</h2><div id="supervisor" class="body">Загрузка…</div><div class="actions"><button id="restartSupervisor" class="primary">Перезапустить Supervisor</button></div></section>
  <section class="card"><h2>Хост</h2><div id="host" class="body">Загрузка…</div><div class="actions"><button id="reboot" class="primary">Перезагрузить хост</button><button id="shutdown" class="danger">Выключить хост</button><span class="version">v${HA_SYSTEM_PANEL_VERSION}</span></div></section>
 </div>
 <section class="log"><div class="loghead"><h2>Журнал системы</h2><div class="controls"><input id="search" placeholder="Поиск в журнале…" maxlength="100"><select id="source"><option value="core">Core</option><option value="supervisor" selected>Supervisor</option><option value="host">Host</option></select><button id="pause">⏸ Пауза</button><button id="bottom">↓ В конец</button></div></div><pre id="output">Загрузка журнала…</pre></section>
</div><div id="toast" class="toast"></div>`;
    this.$('#refresh').onclick=()=>this._load(true);this.$('#source').onchange=()=>this._loadLogs();this.$('#search').oninput=()=>this._filter();this.$('#bottom').onclick=()=>{const p=this.$('#output');p.scrollTop=p.scrollHeight};
    this.$('#pause').onclick=e=>{this._paused=!this._paused;e.target.textContent=this._paused?'▶ Продолжить':'⏸ Пауза';if(!this._paused)this._loadLogs()};
    this.$('#restartCore').onclick=()=>this._action('homeassistant','restart','Перезапуск Home Assistant Core','Перезапустить Home Assistant Core?\n\nHome Assistant будет временно недоступен.');
    this.$('#restartSupervisor').onclick=()=>this._action('hassio','restart_supervisor','Перезапуск Supervisor','Перезапустить Supervisor?\n\nУправление дополнениями и системой будет временно недоступно.');
    this.$('#reboot').onclick=()=>this._action('hassio','host_reboot','Перезагрузка хоста','Перезагрузить хост Home Assistant?\n\nВся система будет временно недоступна.');
    this.$('#shutdown').onclick=()=>this._action('hassio','host_shutdown','Выключение хоста','Выключить хост Home Assistant?\n\nПосле выключения потребуется физически включить устройство.');
  }
  $(s){return this.querySelector(s)}
  _esc(v){return String(v??'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  _row(k,v,c='',html=false){return `<div class="row"><span class="label">${this._esc(k)}</span><span class="value ${c}">${html?v:this._esc(v)}</span></div>`}
  _bar(v){let n=parseFloat(v);n=Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;return `<div class="barwrap"><div class="bar ${n<60?'low':n<85?'mid':'high'}" style="width:${n}%"></div></div>`}
  _pct(v){const n=parseFloat(v);return Number.isFinite(n)?`${n.toFixed(1)}%`:'—'}
  _bytes(v){let n=Number(v);if(!Number.isFinite(n))return'—';const u=['Б','КБ','МБ','ГБ','ТБ'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return`${n.toFixed(i>2?1:0)} ${u[i]}`}
  _unit(e){if(!e||['unknown','unavailable'].includes(e.state))return'—';const n=parseFloat(e.state);return Number.isFinite(n)?`${n.toFixed(1)} ${e.attributes?.unit_of_measurement||''}`.trim():e.state}
  _version(e,f='—'){const installed=e?.attributes?.installed_version||f||'—',latest=e?.attributes?.latest_version;return e?.state==='on'&&latest?`${this._esc(installed)}<span class="badge">Доступно: ${this._esc(latest)}</span>`:this._esc(installed)}
  _state(states,...ids){return ids.map(id=>states.find(x=>x.entity_id===id)).find(Boolean)||null}
  _sensor(states,keys,units=null){return states.find(s=>s.entity_id.startsWith('sensor.')&&keys.some(k=>s.entity_id.includes(k))&&(!units||units.includes(s.attributes?.unit_of_measurement)))||null}
  async _load(toast=false){if(this._busy)return;this._busy=true;try{
    const [states,cfg,coreStats,supStats,hostInfo]=await Promise.all([this._ws({type:'get_states'}),this._ws({type:'get_config'}).catch(()=>null),this._safe('core/stats'),this._safe('supervisor/stats'),this._safe('host/info')]);
    const coreUp=this._state(states,'update.home_assistant_core_update'),supUp=this._state(states,'update.home_assistant_supervisor_update'),osUp=this._state(states,'update.home_assistant_operating_system_update');
    const cpu=this._sensor(states,['processor_use','processor_load','cpu_usage'],['%']),load=this._sensor(states,['load_1_min','load_1m','load1']),ram=this._sensor(states,['memory_usage','memory_use_percent','virtual_memory'],['%']),ramUse=this._sensor(states,['memory_use'],['MiB','MB','GB','GiB']),ramFree=this._sensor(states,['memory_free'],['MiB','MB','GB','GiB']),disk=this._sensor(states,['disk_usage','disk_use_percent'],['%']),diskUse=this._sensor(states,['disk_use'],['GiB','GB']),diskFree=this._sensor(states,['disk_free'],['GiB','GB']),lastBoot=this._sensor(states,['last_boot']);
    const coreCpu=coreStats?.cpu_percent??cpu?.state,coreRam=coreStats?.memory_percent??ram?.state;
    this.$('#core').innerHTML=this._row('Версия',this._version(coreUp,cfg?.version),'',true)+this._row('Использование ЦП',this._pct(coreCpu))+this._bar(coreCpu)+this._row('Использование ОЗУ',this._pct(coreRam))+this._bar(coreRam)+this._row('Занято памяти',coreStats?.memory_usage!=null?this._bytes(coreStats.memory_usage):this._unit(ramUse))+(load?this._row('Средняя нагрузка (1 мин)',parseFloat(load.state).toFixed(2)):'');
    const supCpu=supStats?.cpu_percent,supRam=supStats?.memory_percent,supAvail=supUp?.state==='on';
    this.$('#supervisor').innerHTML=this._row('Версия',this._version(supUp),'',true)+this._row('Использование ЦП',this._pct(supCpu))+this._bar(supCpu)+this._row('Использование ОЗУ',this._pct(supRam))+this._bar(supRam)+this._row('Занято памяти',supStats?.memory_usage!=null?this._bytes(supStats.memory_usage):'—')+this._row('Обновление Supervisor',supAvail?'Доступно':'Не требуется',supAvail?'warn':'');
    const osAvail=osUp?.state==='on',boot=lastBoot?.state&&!['unknown','unavailable'].includes(lastBoot.state)?new Date(lastBoot.state).toLocaleString('ru-RU'):'—';
    this.$('#host').innerHTML=this._row('Имя хоста',hostInfo?.hostname||'—')+this._row('Операционная система',hostInfo?.operating_system||hostInfo?.os_name||'Home Assistant OS')+this._row('Версия HA OS',this._version(osUp),'',true)+this._row('Обновление HA OS',osAvail?'Доступно':'Не требуется',osAvail?'warn':'')+this._row('Последний запуск',boot)+this._row('Использование диска',this._pct(disk?.state))+this._bar(disk?.state)+this._row('Занято на диске',this._unit(diskUse))+this._row('Свободно на диске',this._unit(diskFree))+(ramFree?this._row('Свободно ОЗУ хоста',this._unit(ramFree)):'');
    this.$('#updated').textContent=`Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;if(!this._paused)await this._loadLogs();if(toast)this._toast('Данные системы обновлены');
  }catch(e){console.error('[HA System Panel]',e);this._error(e.message);if(toast)this._toast(`Ошибка: ${e.message}`)}finally{this._busy=false}}
  async _loadLogs(){const src=this.$('#source')?.value,p=this.$('#output');if(!src||!p)return;const endpoint=src==='core'?'core/logs':src==='host'?'host/logs':'supervisor/logs';try{const text=await this._api(endpoint);this._lines=text.trim().split('\n').slice(-300).map(x=>x.replace(/\x1b\[[0-9;]*m/g,''));this._filter()}catch(e){p.textContent=`Не удалось загрузить журнал: ${e.message}`}}
  _filter(){const p=this.$('#output');if(!p)return;const q=(this.$('#search')?.value||'').toLowerCase().trim().slice(0,100),lines=q?this._lines.filter(x=>x.toLowerCase().includes(q)):this._lines;if(!lines.length){p.textContent=q?'Совпадений не найдено.':'Журнал пуст.';return}p.innerHTML=lines.map(x=>`<span class="${/error|critical|fatal/i.test(x)?'err':/warning|warn/i.test(x)?'warning':''}${q?' hit':''}">${this._esc(x)}</span>`).join('\n');if(!q)p.scrollTop=p.scrollHeight}
  async _action(domain,service,title,confirmText){if(!window.confirm(confirmText))return;this._toast(`${title}…`);try{await this._ws({type:'call_service',domain,service,service_data:{}});this._toast(`${title}: команда отправлена.`)}catch(e){this._toast(`Ошибка: ${e.message}`)}}
  _error(msg){['#core','#supervisor','#host'].forEach(s=>{const e=this.$(s);if(e)e.innerHTML=`<span class="err">Ошибка: ${this._esc(msg||'неизвестная ошибка')}</span>`});const u=this.$('#updated');if(u)u.textContent='Ошибка загрузки'}
  _toast(msg){const t=this.$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(this._tt);this._tt=setTimeout(()=>t.classList.remove('show'),3200)}
}
if(!customElements.get('ha-system-panel'))customElements.define('ha-system-panel',HaSystemPanel);
