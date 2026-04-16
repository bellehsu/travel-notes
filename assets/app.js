let currentMapId = "";
let currentLocations = [];

function getTrip() {
  const params = new URLSearchParams(window.location.search);
  return params.get("trip");
}

function resolveJsonPath() {
  const trip = getTrip();
  if (!trip) return "./trip.json";
  return `./data/${trip}/trip.json`;
}

function money(v){return new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(Number(v||0));}
function nonEmpty(v){return v !== undefined && v !== null && String(v).trim() !== '';}
function escapeHtml(value){return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function embedUrl(url){
  try{
    const u = new URL(url);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || url;
    return 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
  }catch{
    return 'https://www.google.com/maps?q=' + encodeURIComponent(url || '台灣') + '&output=embed';
  }
}
function setStatus(text){document.getElementById('loadStatus').textContent = text;}
function normalizeStayGroups(data){
  if(Array.isArray(data.stay_groups) && data.stay_groups.length) return data.stay_groups;
  const grouped = {};
  (data.stays || []).forEach(item => {
    const key = item.area || 'other';
    if(!grouped[key]) grouped[key] = {key:key,label:key,items:[]};
    grouped[key].items.push(item);
  });
  return Object.values(grouped);
}
function normalizeShopGroups(data){
  if(Array.isArray(data.shop_groups) && data.shop_groups.length) return data.shop_groups;
  const grouped = {};
  (data.shops || []).forEach(item => {
    const key = item.tag || 'other';
    if(!grouped[key]) grouped[key] = {key:key,label:key || '資訊',items:[]};
    grouped[key].items.push(item);
  });
  return Object.values(grouped);
}
function makeMapTarget(item){
  if(nonEmpty(item?.map)) return item.map;
  if(nonEmpty(item?.address)) return 'https://www.google.com/maps?q=' + encodeURIComponent(item.address);
  return '';
}
function extraFields(obj, hiddenKeys){return Object.entries(obj || {}).filter(([k,v]) => !hiddenKeys.includes(k) && nonEmpty(v));}
function getMapTarget(item){
  if(nonEmpty(item.map)) return item.map;
  if(nonEmpty(item.address)) return "https://www.google.com/maps?q=" + encodeURIComponent(item.address);
  return "";
}
function renderExtraRows(entries){
  if(!entries.length) return '';
  return "<div class='extras'>" + entries.map(([k,v]) => "<div class='extra-row'><strong>" + escapeHtml(k) + "：</strong>" + escapeHtml(Array.isArray(v) ? v.join('、') : v) + "</div>").join('') + '</div>';
}
function buildMapButton(mapId){
  if(!nonEmpty(mapId)) return '';
  return "<button type='button' class='btn map-switch-btn' data-mapid='" + escapeHtml(mapId) + "'>切換地圖</button>";
}
function updateActiveStates(){
  document.querySelectorAll('[data-mapid]').forEach(el => {
    if(el.classList.contains('map-switch-btn')) return;
    el.classList.toggle('active-map', el.dataset.mapid === currentMapId);
  });
  document.querySelectorAll('.location').forEach(el => el.classList.toggle('active', el.dataset.mapid === currentMapId));
}
function focusMapById(mapId){
  const item = currentLocations.find(x => x.id === mapId);
  if(!item) return;
  currentMapId = mapId;
  document.getElementById('mapFrame').src = embedUrl(item.map);
  document.getElementById('mapFocus').innerHTML =
    '<div class="small muted">' + escapeHtml(item.source) + '</div>' +
    '<h3>' + escapeHtml(item.title) + '</h3>' +
    (nonEmpty(item.subtitle) ? '<div class="muted" style="margin-top:6px">' + escapeHtml(item.subtitle) + '</div>' : '') +
    (nonEmpty(item.address) ? '<div style="margin-top:10px"><strong>地址：</strong>' + escapeHtml(item.address) + '</div>' : '') +
    "<div class='actions'>" +
      "<a class='btn secondary' href='" + escapeHtml(item.map) + "' target='_blank' rel='noopener noreferrer'>開啟 Google Maps</a>" +
    '</div>';
  updateActiveStates();
}
function rebuildLocationList(locations){
  currentLocations = locations;
  const box = document.getElementById('locationList');
  box.innerHTML = '';
  if(!locations.length){
    document.getElementById('mapFrame').src = embedUrl('台灣');
    document.getElementById('mapFocus').innerHTML = '<div class="muted">目前沒有可顯示的 map / address 資料。</div>';
    return;
  }
  locations.forEach((loc, idx) => {
    const div = document.createElement('div');
    div.className = 'location' + (idx === 0 ? ' active' : '');
    div.dataset.mapid = loc.id;
    div.innerHTML =
      '<div class="loc-title">' + escapeHtml(loc.title) + '</div>' +
      (nonEmpty(loc.address) ? '<div class="loc-sub">' + escapeHtml(loc.address) + '</div>' : '');
    div.addEventListener('click', () => focusMapById(loc.id));
    box.appendChild(div);
  });
  focusMapById(locations[0].id);
}
function collectLocations(data, stayGroups, shopGroups){
  const locations = [];
  let seq = 0;
  (data.days || []).forEach((day, dayIndex) => (day.stops || []).forEach((stop, stopIndex) => {
    const map = makeMapTarget(stop);
    if(!map) return;
    locations.push({
      id:`day-${day.key || dayIndex}-${stopIndex}`,
      map,
      source:(data.day_tabs_name || '每日行程') + ' / ' + (day.label || `Day ${dayIndex+1}`),
      title:stop.maps_label || stop.name || '地點',
      subtitle:[stop.type, stop.time, stop.cost].filter(Boolean).join('｜'),
      address:stop.short_address || stop.address || '',
      order:seq++
    });
  }));
  stayGroups.forEach((group, groupIndex) => (group.items || []).forEach((item, itemIndex) => {
    const map = makeMapTarget(item);
    if(!map) return;
    locations.push({
      id:`stay-${group.key || groupIndex}-${itemIndex}`,
      map,
      source:(data.stay_tabs_name || '住宿資訊卡') + ' / ' + (group.label || '住宿'),
      title:item.name || '住宿',
      subtitle:item.note || item.reference || '',
      address:item.address || item.area || '',
      order:seq++
    });
  }));
  shopGroups.forEach((group, groupIndex) => (group.items || []).forEach((item, itemIndex) => {
    const map = makeMapTarget(item);
    if(!map) return;
    locations.push({
      id:`shop-${group.key || groupIndex}-${itemIndex}`,
      map,
      source:(data.shop_tabs_name || '資訊分類') + ' / ' + (group.label || '資訊'),
      title:item.name || '店家',
      subtitle:[item.tag, item.price, item.note].filter(Boolean).join('｜'),
      address:item.address || '',
      order:seq++
    });
  }));
  return locations;
}
function attachMapInteractions(){
  document.querySelectorAll('.map-target').forEach(card => {
    card.addEventListener('click', (event) => {
      const isAnchor = event.target.closest('a');
      if(isAnchor) return;
      const btn = event.target.closest('.map-switch-btn');
      if(btn){
        focusMapById(btn.dataset.mapid);
        event.stopPropagation();
        return;
      }
      const id = card.dataset.mapid;
      if(id) focusMapById(id);
    });
  });
  document.querySelectorAll('.map-switch-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      focusMapById(btn.dataset.mapid);
    });
  });
}

function render(data){
  currentMapId = '';
  document.getElementById('title').textContent = data.title || '';
  document.getElementById('subtitle').textContent = data.subtitle || '';
  document.getElementById('dates').textContent = data.dates || '';
  document.getElementById('travelers').textContent = (data.travelers || 0) + ' 人';
  document.getElementById('budgetPerPerson').textContent = money(data.budget_per_person || 0) + ' / 人';
  document.getElementById('nights').textContent = data.nights || '';
  document.getElementById('dayTabsName').textContent = data.day_tabs_name || '每日行程';
  document.getElementById('stayTabsName').textContent = data.stay_tabs_name || '住宿資訊卡';
  document.getElementById('shopTabsName').textContent = data.shop_tabs_name || '店家 / 活動 / 交通資訊卡';
  document.getElementById('budgetTabsName').textContent = data.budget_tabs_name || '預算分類';

  const reminderList = document.getElementById('reminderList');
  reminderList.innerHTML = '';
  (data.reminders || []).forEach(r => {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.textContent = r;
    reminderList.appendChild(div);
  });

  const stayGroups = normalizeStayGroups(data);
  const shopGroups = normalizeShopGroups(data);

  const dayTabs = document.getElementById('dayTabs');
  const dayContent = document.getElementById('dayContent');
  dayTabs.innerHTML = '';
  let activeDay = (data.days && data.days[0] && data.days[0].key) || '';
  function renderDay(key){
    const day = (data.days || []).find(d => d.key === key) || (data.days || [])[0];
    if(!day){dayContent.innerHTML = '<div class="item-card">沒有行程資料</div>'; return;}
    let stopsHtml = '';
    (day.stops || []).forEach((stop, idx) => {
      const mapId = `day-${day.key || 'day'}-${idx}`;
      const mapTarget = makeMapTarget(stop);
      const extras = renderExtraRows(extraFields(stop, ['time','name','maps_label','short_address','type','stay','cost','address','note','next','map','highlight']));
      stopsHtml +=
        "<div class='stop" + (mapTarget ? " map-target" : "") + "'" + (mapTarget ? " data-mapid='" + escapeHtml(mapId) + "'" : '') + ">" +
          "<div class='stop-top'><div><div class='stop-title'>" + escapeHtml(stop.name || '') + (stop.highlight ? " <span class='badge'>重點</span>" : '') + "</div>" +
          "<div class='stop-meta'>" +
            (nonEmpty(stop.time) ? "<span class='time-pill'>" + escapeHtml(stop.time) + "</span>" : '') +
            (nonEmpty(stop.stay) ? "<span class='pill'>" + escapeHtml(stop.stay) + "</span>" : '') +
            (nonEmpty(stop.type) ? "<span class='pill'>" + escapeHtml(stop.type) + "</span>" : '') +
          "</div></div>" +
          (nonEmpty(stop.cost) ? "<div class='cost-pill'>" + escapeHtml(stop.cost) + "</div>" : '') +
          "</div>" +
          "<div class='addr-box'><div class='box'><div class='small muted'>地址</div><div>" + escapeHtml(stop.address || '—') + "</div></div></div>" +
          (nonEmpty(stop.note) ? "<div style='margin-top:12px;line-height:1.7'>" + escapeHtml(stop.note) + "</div>" : '') +
          extras +
          "<div class='actions'>" + buildMapButton(mapTarget ? mapId : '') +
          (nonEmpty(stop.next) ? "<span class='pill'>前往下一站：" + escapeHtml(stop.next) + "</span>" : '') + "</div>" +
        "</div>";
    });
    dayContent.innerHTML =
      "<div class='day-header'><div class='small muted'>" + escapeHtml(day.label || '') + "</div><div style='font-size:26px;font-weight:800;margin-top:4px'>" + escapeHtml(day.title || '') + "</div>" +
      (nonEmpty(day.theme) ? "<div class='muted' style='margin-top:6px'>" + escapeHtml(day.theme) + "</div>" : '') +
      (nonEmpty(day.hero) ? "<div style='margin-top:10px'><span class='badge'>重點：" + escapeHtml(day.hero) + "</span></div>" : '') +
      "</div><div class='stops'>" + stopsHtml + '</div>';
    [...dayTabs.querySelectorAll('.tab-btn')].forEach(btn => btn.classList.toggle('active', btn.dataset.key === day.key));
    attachMapInteractions();
    updateActiveStates();
  }
  (data.days || []).forEach((day, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (day.key === activeDay ? ' active' : '');
    btn.textContent = day.label || ('Day ' + (index + 1));
    btn.dataset.key = day.key;
    btn.onclick = () => { activeDay = day.key; renderDay(day.key); };
    dayTabs.appendChild(btn);
  });
  renderDay(activeDay);

  const stayTabs = document.getElementById('stayTabs');
  const stayContent = document.getElementById('stayContent');
  stayTabs.innerHTML = '';
  let activeStay = (stayGroups[0] && stayGroups[0].key) || '';
  function renderStayGroup(key){
    const group = stayGroups.find(g => g.key === key) || stayGroups[0];
    if(!group){stayContent.innerHTML = '<div class="item-card">沒有住宿資料</div>'; return;}
    stayContent.innerHTML = "<div class='list'>" + (group.items || []).map((s, idx) => {
      const mapTarget = makeMapTarget(s);
      const mapId = `stay-${group.key || 'stay'}-${idx}`;
      const extras = renderExtraRows(extraFields(s, ['area','name','note','link','map','address']));
      return "<div class='item-card" + (mapTarget ? " map-target" : "") + "'" + (mapTarget ? " data-mapid='" + escapeHtml(mapId) + "'" : '') + ">" +
        "<div style='display:flex;justify-content:space-between;gap:10px'><strong>" + escapeHtml(s.name || '') + "</strong><span class='badge'>" + escapeHtml(s.area || group.label || '') + "</span></div>" +
        (nonEmpty(s.note) ? "<div class='muted small' style='margin-top:8px'>" + escapeHtml(s.note) + "</div>" : '') +
        (nonEmpty(s.address) ? "<div class='extra-row' style='margin-top:12px'><strong>地址：</strong>" + escapeHtml(s.address) + "</div>" : '') +
        extras +
        "<div class='actions'>" + buildMapButton(mapTarget ? mapId : '') +
        (nonEmpty(s.link) ? "<a class='btn secondary' href='" + escapeHtml(s.link) + "' target='_blank' rel='noopener noreferrer'>查看住宿</a>" : '') + "</div></div>";
    }).join('') + '</div>';
    [...stayTabs.querySelectorAll('.tab-btn')].forEach(btn => btn.classList.toggle('active', btn.dataset.key === group.key));
    attachMapInteractions();
    updateActiveStates();
  }
  stayGroups.forEach((group, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (group.key === activeStay ? ' active' : '');
    btn.textContent = group.label || ('群組 ' + (index + 1));
    btn.dataset.key = group.key;
    btn.onclick = () => { activeStay = group.key; renderStayGroup(group.key); };
    stayTabs.appendChild(btn);
  });
  renderStayGroup(activeStay);

  const shopTabs = document.getElementById('shopTabs');
  const shopContent = document.getElementById('shopContent');
  shopTabs.innerHTML = '';
  let activeShop = (shopGroups[0] && shopGroups[0].key) || '';
  function renderShopGroup(key){
    const group = shopGroups.find(g => g.key === key) || shopGroups[0];
    if(!group){shopContent.innerHTML = '<div class="item-card">沒有店家 / 活動資料</div>'; return;}
    shopContent.innerHTML = "<div class='list'>" + (group.items || []).map((s, idx) => {
      const mapTarget = makeMapTarget(s);
      const mapId = `shop-${group.key || 'shop'}-${idx}`;
      const extras = renderExtraRows(extraFields(s, ['name','tag','price','note','link','map','address']));
      return "<div class='item-card" + (mapTarget ? " map-target" : "") + "'" + (mapTarget ? " data-mapid='" + escapeHtml(mapId) + "'" : '') + ">" +
        "<div style='display:flex;justify-content:space-between;gap:10px'><strong>" + escapeHtml(s.name || '') + "</strong><span class='badge'>" + escapeHtml(s.tag || group.label || '資訊') + "</span></div>" +
        (nonEmpty(s.price) ? "<div style='margin-top:8px'>" + escapeHtml(s.price) + "</div>" : '') +
        (nonEmpty(s.note) ? "<div class='muted small' style='margin-top:6px'>" + escapeHtml(s.note) + "</div>" : '') +
        (nonEmpty(s.address) ? "<div class='extra-row' style='margin-top:12px'><strong>地址：</strong>" + escapeHtml(s.address) + "</div>" : '') +
        extras +
        "<div class='actions'>" + buildMapButton(mapTarget ? mapId : '') +
        (nonEmpty(s.link) ? "<a class='btn secondary' href='" + escapeHtml(s.link) + "' target='_blank' rel='noopener noreferrer'>查看連結</a>" : '') + "</div></div>";
    }).join('') + '</div>';
    [...shopTabs.querySelectorAll('.tab-btn')].forEach(btn => btn.classList.toggle('active', btn.dataset.key === group.key));
    attachMapInteractions();
    updateActiveStates();
  }
  shopGroups.forEach((group, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (group.key === activeShop ? ' active' : '');
    btn.textContent = group.label || ('分類 ' + (index + 1));
    btn.dataset.key = group.key;
    btn.onclick = () => { activeShop = group.key; renderShopGroup(group.key); };
    shopTabs.appendChild(btn);
  });
  renderShopGroup(activeShop);

  const budgetTabs = document.getElementById('budgetTabs');
  const budgetContent = document.getElementById('budgetContent');
  budgetTabs.innerHTML = '';
  const grandTotal = (data.budget_items || []).reduce((a,b)=>a + Number(b.value || 0), 0);
  let activeBudget = '總額';
  function renderBudget(label){
    if(label === '總額'){
      budgetContent.innerHTML = "<div class='item-card'><div style='display:flex;justify-content:space-between;gap:10px'><strong>總額</strong><span class='badge'>" + money(grandTotal) + "</span></div><div class='details-wrap'>" + (data.budget_items || []).map(item => "<div class='details-row'><div><strong>" + escapeHtml(item.label || '') + "</strong></div><div>" + money(item.value || 0) + "</div></div>").join('') + "</div><div class='summary-box'><div class='small' style='opacity:.8'>全部分類加總</div><div style='font-size:24px;font-weight:800;margin-top:6px'>" + money(grandTotal) + "</div></div></div>";
    } else {
      const item = (data.budget_items || []).find(b => b.label === label) || (data.budget_items || [])[0];
      if(!item) return;
      const details = Array.isArray(item.details) ? item.details : [];
      const detailsSum = details.reduce((a,b)=>a + Number(b.amount || 0), 0);
      const pct = grandTotal ? Math.round(Number(item.value || 0) / grandTotal * 100) : 0;
      budgetContent.innerHTML = "<div class='item-card'><div style='display:flex;justify-content:space-between;gap:10px'><strong>" + escapeHtml(item.label || '') + "</strong><span class='badge'>" + money(item.value || 0) + "</span></div><div style='margin-top:10px' class='budget-bar'><div style='width:" + pct + "%'></div></div><div style='margin-top:12px' class='small muted'>分類占比：" + pct + "%</div>" + (details.length ? "<div class='details-wrap'>" + details.map(d => "<div class='details-row'><div><strong>" + escapeHtml(d.name || '項目') + "</strong>" + (nonEmpty(d.note) ? "<div class='small muted' style='margin-top:4px'>" + escapeHtml(d.note) + "</div>" : '') + "</div><div>" + money(d.amount || 0) + "</div></div>").join('') + "</div><div class='summary-box'><div class='small' style='opacity:.8'>明細加總</div><div style='font-size:24px;font-weight:800;margin-top:6px'>" + money(detailsSum) + "</div></div>" : "<div class='small muted' style='margin-top:12px'>尚未提供明細</div>") + '</div>';
    }
    [...budgetTabs.querySelectorAll('.tab-btn')].forEach(btn => btn.classList.toggle('active', btn.dataset.key === label));
  }
  const totalBtn = document.createElement('button');
  totalBtn.className = 'tab-btn active';
  totalBtn.textContent = '總額';
  totalBtn.dataset.key = '總額';
  totalBtn.onclick = () => { activeBudget = '總額'; renderBudget('總額'); };
  budgetTabs.appendChild(totalBtn);
  (data.budget_items || []).forEach((item, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = item.label || ('分類 ' + (index + 1));
    btn.dataset.key = item.label;
    btn.onclick = () => { activeBudget = item.label; renderBudget(item.label); };
    budgetTabs.appendChild(btn);
  });
  renderBudget(activeBudget);

  const locations = collectLocations(data, stayGroups, shopGroups);
  rebuildLocationList(locations);
  attachMapInteractions();
  updateActiveStates();
}

async function loadJsonFile(file){
  if(!file) return;
  if(!/\.json$/i.test(file.name) && file.type && !file.type.includes('json')){
    setStatus('檔案不是 JSON');
    return;
  }
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    render(parsed);
    setStatus('已載入：' + file.name);
  }catch(err){
    console.error(err);
    setStatus('JSON 讀取失敗');
    alert('JSON 讀取失敗，請確認格式正確。');
  }
}

document.getElementById('fileInput').addEventListener('change', (e) => loadJsonFile(e.target.files[0]));
async function loadDefaultJson() {
  try {
    const url = resolveJsonPath();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    render(data);
    const trip = getTrip();
    setStatus(trip ? `目前行程：${trip}` : '預設 trip.json');

  } catch (err) {
    console.error(err);
    setStatus('載入失敗');
  }
}
const dropzone = document.getElementById('dropzone');
['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', e => {
  const file = [...(e.dataTransfer?.files || [])].find(f => /\.json$/i.test(f.name) || (f.type && f.type.includes('json')));
  loadJsonFile(file);
});
loadDefaultJson();
