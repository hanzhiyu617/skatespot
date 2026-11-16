import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const languageStorageKey = 'skatespot-language-v1';
const voterStorageKey = 'skatespot-rating-voter-v1';
const savedLanguage = localStorage.getItem(languageStorageKey);
const state = {
  query: '',
  regions: new Set(),
  types: new Set(),
  selectedId: null,
  spots: [],
  ratings: {},
  adapter: null,
  language: ['ko', 'zh', 'en'].includes(savedLanguage) ? savedLanguage : 'ko'
};
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[character]));

const copy = {
  en: {
    eyebrow: 'SKATE SPOTS IN KOREA', headline: 'Find your line. Find your spot.', intro: 'The streets are calling..',
    search: 'Search a spot or city', region: 'REGION', type: 'TYPE', clear: 'Clear',
    localNote: 'New spots appear immediately. Help keep the directory accurate.', mapStatus: 'OpenStreetMap',
    addSpot: '+ Add a spot', community: 'COMMUNITY', addSpotTitle: 'Add a spot', formNote: 'Your spot will appear publicly as soon as it is submitted.',
    nameEn: 'English name', nameKo: 'Korean name', nameZh: 'Chinese name', city: 'City / region', select: 'Select one',
    latitude: 'Latitude', longitude: 'Longitude', notes: 'Notes', optional: 'optional',
    notesPlaceholder: 'Obstacles, opening hours, or useful details', submitReview: 'Add to map', submitting: 'Adding...',
    admin: 'ADMIN', reviewTitle: 'Manage spots', reviewNote: 'Enter the admin token to remove a public spot.',
    adminToken: 'Admin token', loadQueue: 'Load spots', deleteSpot: 'Delete', confirmDelete: 'Delete this spot from the public map?',
    pendingEmpty: 'No spots to manage.', noMatches: 'No matching spots. Try clearing a filter.',
    spots: 'spots', spot: 'spot', submitted: 'Spot added to the public map.', mapUnavailable: 'Map unavailable',
    loadingError: 'Could not load spots. Check that the backend is running.',
    ratingLabels: ['Poor', 'Fair', 'Good', 'Great', 'Superb'],
    regions: { Seoul: 'Seoul', Gyeonggi: 'Gyeonggi', Incheon: 'Incheon', Busan: 'Busan', Gangwon: 'Gangwon', Other: 'Other' },
    types: { Outdoor: 'Outdoor', Indoor: 'Indoor', Street: 'Street' }
  },
  ko: {
    eyebrow: '대한민국 스케이트 스팟', headline: 'Find your line. Find your spot.', intro: 'The streets are calling..',
    search: '스팟 또는 도시 검색', region: '지역', type: '유형', clear: '초기화',
    localNote: '새 장소는 즉시 공개됩니다. 정확한 정보를 함께 관리해 주세요.', mapStatus: 'OpenStreetMap',
    addSpot: '+ 스팟 추가', community: '커뮤니티', addSpotTitle: '스팟 추가', formNote: '제출 즉시 장소가 공개됩니다.',
    nameEn: '영어 이름', nameKo: '한국어 이름', nameZh: '중국어 이름', city: '도시 / 지역', select: '선택하세요',
    latitude: '위도', longitude: '경도', notes: '메모', optional: '선택',
    notesPlaceholder: '시설, 운영 시간 또는 유용한 정보', submitReview: '지도에 추가', submitting: '추가 중...',
    admin: '관리자', reviewTitle: '장소 관리', reviewNote: '관리자 토큰을 입력하면 공개 장소를 삭제할 수 있습니다.',
    adminToken: '관리자 토큰', loadQueue: '장소 불러오기', deleteSpot: '삭제', confirmDelete: '이 장소를 지도에서 삭제할까요?',
    pendingEmpty: '관리할 장소가 없습니다.', noMatches: '일치하는 스팟이 없습니다. 필터를 초기화해 보세요.',
    spots: '곳', spot: '곳', submitted: '장소가 지도에 추가되었습니다.', mapUnavailable: '지도를 불러올 수 없습니다.',
    loadingError: '스팟을 불러오지 못했습니다. 백엔드가 실행 중인지 확인하세요.',
    ratingLabels: ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'],
    regions: { Seoul: '서울', Gyeonggi: '경기', Incheon: '인천', Busan: '부산', Gangwon: '강원', Other: '기타' },
    types: { Outdoor: '야외', Indoor: '실내', Street: '스트리트' }
  },
  zh: {
    eyebrow: '韩国滑板地点', headline: 'Find your line. Find your spot.', intro: 'The streets are calling.',
    search: '搜索地点或城市', region: '地区', type: '类型', clear: '清除',
    localNote: '新地点提交后立即公开，请帮助维护信息准确。', mapStatus: 'OpenStreetMap',
    addSpot: '+ 添加地点', community: '社区', addSpotTitle: '添加地点', formNote: '提交后地点会立即公开显示。',
    nameEn: '英文名称', nameKo: '韩文名称', nameZh: '中文名称', city: '城市 / 地区', select: '请选择',
    latitude: '纬度', longitude: '经度', notes: '备注', optional: '可选',
    notesPlaceholder: '设施、开放时间或实用信息', submitReview: '添加到地图', submitting: '正在添加...',
    admin: '管理员', reviewTitle: '管理地点', reviewNote: '输入管理员令牌即可删除公开地点。',
    adminToken: '管理员令牌', loadQueue: '加载地点', deleteSpot: '删除', confirmDelete: '确定从地图中删除此地点吗？',
    pendingEmpty: '暂无可管理的地点。', noMatches: '没有匹配地点。请尝试清除筛选。',
    spots: '个地点', spot: '个地点', submitted: '地点已添加到地图。', mapUnavailable: '地图不可用',
    loadingError: '无法加载地点，请确认后端服务正在运行。',
    ratingLabels: ['很差', '一般', '还不错', '很好', '非常棒'],
    regions: { Seoul: '首尔', Gyeonggi: '京畿道', Incheon: '仁川', Busan: '釜山', Gangwon: '江原道', Other: '其他' },
    types: { Outdoor: '户外', Indoor: '室内', Street: '街式' }
  }
};

function t(key) {
  return copy[state.language][key] || copy.en[key] || key;
}

function displayName(spot) {
  return spot.names?.[state.language] || spot.names?.en || spot.names?.ko || spot.id;
}

function displayDescription(spot) {
  return spot.descriptions?.[state.language] || spot.descriptions?.en || '';
}

function displayValue(value) {
  return copy[state.language].regions[value] || copy[state.language].types[value] || value;
}

function getVoterId() {
  let voterId = localStorage.getItem(voterStorageKey);
  if (!voterId) {
    voterId = crypto.randomUUID();
    localStorage.setItem(voterStorageKey, voterId);
  }
  return voterId;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function setMessage(message, isError = false) {
  const node = $('#app-message');
  node.textContent = message;
  node.hidden = !message;
  node.classList.toggle('is-error', isError);
}

function allSpots() {
  return state.spots;
}

class LeafletAdapter {
  init() {
    if (!L) throw new Error('Leaflet did not load. Reinstall dependencies, then reload.');
    this.map = L.map('map', { zoomControl: false }).setView([36.25, 127.85], 7);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
  }

  render(spots, onSelect) {
    this.layer.clearLayers();
    spots.forEach(spot => {
      const icon = L.divIcon({ className: '', html: '<div class="marker-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
      const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(this.layer);
      marker.bindPopup(
        `<p class="popup-title">${escapeHtml(displayName(spot))}</p>` +
        `<p class="popup-meta">${escapeHtml(displayValue(spot.region))} · ${escapeHtml(displayValue(spot.type))}</p>` +
        `<p class="popup-note">${escapeHtml(displayDescription(spot))}</p>`
      );
      marker.on('click', () => onSelect(spot.id));
      if (spot.id === state.selectedId) marker.openPopup();
    });
  }

  focus(spot) {
    this.map.flyTo([spot.lat, spot.lng], 14, { duration: 0.55 });
  }
}

function filteredSpots() {
  const query = state.query.trim().toLocaleLowerCase();
  return allSpots().filter(spot => {
    const searchable = [
      ...Object.values(spot.names || {}),
      ...Object.values(spot.descriptions || {}),
      spot.region,
      displayValue(spot.region),
      displayValue(spot.type)
    ].join(' ').toLocaleLowerCase();
    return (!query || searchable.includes(query)) &&
      (!state.regions.size || state.regions.has(spot.region)) &&
      (!state.types.size || state.types.has(spot.type));
  });
}

function renderFilters() {
  const makeButtons = (target, values, active, label, translations) => {
    target.innerHTML = values.map(value =>
      `<button class="chip" data-filter="${label}" data-value="${escapeHtml(value)}" aria-pressed="${active.has(value)}">${escapeHtml(translations[value])}</button>`
    ).join('');
  };
  makeButtons($('#region-filters'), ['Seoul', 'Gyeonggi', 'Incheon', 'Busan', 'Gangwon', 'Other'], state.regions, 'region', t('regions'));
  makeButtons($('#type-filters'), ['Outdoor', 'Indoor', 'Street'], state.types, 'type', t('types'));
}

function render() {
  const spots = filteredSpots();
  $('#result-count').textContent = `${spots.length} ${spots.length === 1 ? t('spot') : t('spots')}`;
  const template = $('#spot-card-template');
  const list = $('#spot-list');
  list.replaceChildren();

  spots.forEach((spot, index) => {
    const node = template.content.cloneNode(true);
    const button = node.querySelector('.spot-card-button');
    const summary = state.ratings[spot.id] || { average: 0, count: 0, mine: 0 };
    node.querySelector('.spot-number').textContent = String(index + 1).padStart(2, '0');
    node.querySelector('.spot-type').textContent = displayValue(spot.type);
    node.querySelector('h3').textContent = displayName(spot);
    node.querySelector('.spot-meta').textContent = displayValue(spot.region);
    node.querySelector('.spot-description').textContent = displayDescription(spot);
    button.addEventListener('click', () => selectSpot(spot.id));

    const rating = node.querySelector('.spot-rating');
    rating.dataset.ratingSpot = spot.id;
    rating.dataset.average = String(summary.average || 0);
    rating.dataset.count = String(summary.count || 0);
    rating.dataset.mine = String(summary.mine || 0);
    rating.dataset.language = state.language;
    list.append(node);
  });

  if (!spots.length) list.innerHTML = `<p class="local-note">${escapeHtml(t('noMatches'))}</p>`;
  state.adapter.render(spots, id => selectSpot(id, false));
}

function selectSpot(id, focus = true) {
  state.selectedId = id;
  const spot = allSpots().find(item => item.id === id);
  if (spot && focus) state.adapter.focus(spot);
  render();
}

function applyLanguage() {
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : state.language;
  document.title = `skatespot — ${t('headline')}`;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const translated = t(node.dataset.i18n);
    const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.nodeValue.trim());
    if (textNode) textNode.nodeValue = translated;
    else if (node.matches('label')) node.setAttribute('aria-label', translated);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('#spot-form select[name="region"] option[value], #spot-form select[name="type"] option[value]').forEach(option => {
    if (option.value) option.textContent = displayValue(option.value);
  });
  $('#map-status').textContent = t('mapStatus');
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === state.language));
  });
  const headline = $('#headline-root');
  headline.dataset.text = t('headline');
  window.dispatchEvent(new CustomEvent('skatespot:headline', { detail: t('headline') }));
  renderFilters();
  render();
}

function openDialog() {
  $('#spot-dialog').showModal();
}

function closeSpotDialog() {
  const dialog = $('#spot-dialog');
  if (dialog.open) dialog.close();
}

async function loadManagedSpots() {
  const list = $('#review-list');
  const token = $('#admin-token').value.trim();
  $('#review-error').textContent = '';
  try {
    const spots = await requestJson('/api/admin/spots', {
      headers: { Authorization: `Bearer ${token}` }
    });
    list.innerHTML = spots.length
      ? spots.map(spot =>
        `<article class="review-item"><h3>${escapeHtml(spot.names?.[state.language] || spot.names?.en || '')}</h3>` +
        `<p>${escapeHtml(displayValue(spot.region))} · ${escapeHtml(displayValue(spot.type))} · ${Number(spot.lat).toFixed(4)}, ${Number(spot.lng).toFixed(4)}</p>` +
        `<p>${escapeHtml(spot.descriptions?.[state.language] || '')}</p>` +
        `<div class="review-actions"><button data-delete="${escapeHtml(spot.id)}">${escapeHtml(t('deleteSpot'))}</button></div></article>`
      ).join('')
      : `<p class="local-note">${escapeHtml(t('pendingEmpty'))}</p>`;
  } catch (error) {
    $('#review-error').textContent = error.message;
    list.replaceChildren();
  }
}

async function deleteSpot(id) {
  if (!window.confirm(t('confirmDelete'))) return;
  try {
    await requestJson(`/api/admin/spots/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${$('#admin-token').value.trim()}` }
    });
    const [spots, ratings] = await Promise.all([
      requestJson('/api/spots'),
      requestJson(`/api/ratings?voterId=${encodeURIComponent(getVoterId())}`)
    ]);
    state.spots = spots;
    state.ratings = ratings;
    render();
    await loadManagedSpots();
  } catch (error) {
    $('#review-error').textContent = error.message;
  }
}

async function loadData() {
  try {
    const [spots, ratings] = await Promise.all([
      requestJson('/api/spots'),
      requestJson(`/api/ratings?voterId=${encodeURIComponent(getVoterId())}`)
    ]);
    state.spots = spots;
    state.ratings = ratings;
    render();
  } catch (error) {
    setMessage(`${t('loadingError')} ${error.message}`, true);
  }
}

function init() {
  try {
    state.adapter = new LeafletAdapter();
    state.adapter.init();
  } catch (error) {
    $('#map').innerHTML = `<div class="map-error">${escapeHtml(t('mapUnavailable'))}: ${escapeHtml(error.message)}</div>`;
    $('#map-status').textContent = t('mapUnavailable');
    state.adapter = { render() {}, focus() {} };
  }

  renderFilters();
  applyLanguage();
  loadData();
  $('#search-input').addEventListener('input', event => {
    state.query = event.target.value;
    render();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    const set = button.dataset.filter === 'region' ? state.regions : state.types;
    if (set.has(button.dataset.value)) set.delete(button.dataset.value);
    else set.add(button.dataset.value);
    renderFilters();
    render();
  });
  $('#clear-filters').addEventListener('click', () => {
    state.regions.clear();
    state.types.clear();
    state.query = '';
    $('#search-input').value = '';
    renderFilters();
    render();
  });
  $('#open-submit').addEventListener('click', openDialog);
  $('#open-submit-mobile').addEventListener('click', openDialog);
  $('#close-spot-dialog').addEventListener('click', closeSpotDialog);
  $('#spot-dialog').addEventListener('click', event => {
    if (event.target === $('#spot-dialog')) closeSpotDialog();
  });
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    state.language = button.dataset.language;
    localStorage.setItem(languageStorageKey, state.language);
    applyLanguage();
  }));
  $('#spot-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorNode = $('#spot-error');
    errorNode.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = t('submitting');
    const data = Object.fromEntries(new FormData(form));
    const descriptions = { en: '', ko: '', zh: '' };
    descriptions[state.language] = data.notes.trim();
    try {
      const createdSpot = await requestJson('/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names: { en: data.nameEn.trim(), ko: data.nameKo.trim(), zh: data.nameZh.trim() },
          region: data.region,
          type: data.type,
          lat: Number(data.lat),
          lng: Number(data.lng),
          descriptions
        })
      });
      state.spots = [...state.spots, createdSpot];
      state.ratings[createdSpot.id] = { average: 0, count: 0, mine: 0 };
      render();
      form.reset();
      closeSpotDialog();
      setMessage(t('submitted'));
    } catch (error) {
      errorNode.textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = t('submitReview');
    }
  });
  $('#close-review').addEventListener('click', () => $('#review-dialog').close());
  $('#load-review').addEventListener('click', loadManagedSpots);
  $('#review-list').addEventListener('click', event => {
    const button = event.target.closest('[data-delete]');
    if (button) deleteSpot(button.dataset.delete);
  });
  window.addEventListener('skatespot:error', event => setMessage(event.detail, true));

  if (new URLSearchParams(location.search).get('review') === 'admin') {
    $('#review-dialog').showModal();
  }
}

init();
