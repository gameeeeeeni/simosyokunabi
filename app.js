// GAS Web API エンドポイント
const API_URL = 'https://script.google.com/macros/s/AKfycbwDO6yS35C-uCBg5jQ-iSTiJIQ5tD02OGIGDms76Mqz9pkhp9eUHMXcSmg1AiCvkiNZ/exec';

// 画像参照フォルダ & フォールバック画像
const GITHUB_IMAGE_BASE = 'https://gameeeeeeni.github.io/Hisupuros/images/';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';

// 累計アクセスカウンター API
const COUNTER_API_URL = 'https://api.counterapi.dev/v1/shimosyoku_portal/visits/up';

let allShops = [];
let currentCategory = 'すべて';
let maxBudget = 10000;
let keyword = '';

// 累計訪問者数の取得 & インクリメント
async function updateVisitorCount() {
  const counterEl = document.getElementById('visitorCount');
  if (!counterEl) return;

  try {
    const response = await fetch(COUNTER_API_URL);
    if (!response.ok) throw new Error('Counter API error');
    const data = await response.json();
    if (data && typeof data.count === 'number') {
      counterEl.textContent = data.count.toLocaleString();
    }
  } catch (e) {
    // 取得失敗時は静かに非表示
    counterEl.textContent = '---';
  }
}

function getStatusClass(status) {
  if (!status) return 'status-open';
  if (status.includes('準備')) return 'status-prep';
  if (status.includes('満席')) return 'status-full';
  if (status.includes('わずか')) return 'status-few';
  if (status.includes('連絡')) return 'status-contact';
  return 'status-open';
}

function formatBudget(min, max) {
  if (min !== null && max !== null) return `¥${min.toLocaleString()} 〜 ¥${max.toLocaleString()}`;
  if (min !== null) return `¥${min.toLocaleString()} 〜`;
  if (max !== null) return `〜 ¥${max.toLocaleString()}`;
  return '予算情報なし';
}

function resolveImageUrl(fileNameOrUrl) {
  const clean = (fileNameOrUrl || '').trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return GITHUB_IMAGE_BASE + clean;
}

async function loadShops() {
  const container = document.getElementById('shopList');
  try {
    const response = await fetch(API_URL + '?t=' + new Date().getTime());
    if (!response.ok) throw new Error('通信ステータス: ' + response.status);

    const data = await response.json();
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8;">データが空です</div>';
      return;
    }

    allShops = data.map((item, idx) => {
      const rawImg = item['店舗画像URL'] || '';
      const images = rawImg.toString().split(/[\r\n,]+/)
        .map(u => resolveImageUrl(u))
        .filter(u => u.length > 0);

      const bMin = item['予算_下限'] !== '' && !isNaN(item['予算_下限']) ? parseInt(item['予算_下限']) : null;
      const bMax = item['予算_上限'] !== '' && !isNaN(item['予算_上限']) ? parseInt(item['予算_上限']) : null;

      return {
        _index: idx,
        id: item['店舗ID'] || '',
        name: item['店舗名'] || '名称未設定',
        category: item['業態'] || 'その他',
        budgetMin: bMin,
        budgetMax: bMax,
        status: item['席状況'] || item['席情報'] || '空席あり',
        updatedAt: item['最終更新日時'] || '',
        weeklyHours: item['今週の営業時間'] || '',
        address: item['住所'] || '',
        tel: item['電話番号'] || '',
        hours: item['営業時間_定休日'] || '',
        menu: item['おすすめメニュー'] || '',
        comment: item['店舗紹介コメント'] || '',
        images: images.length > 0 ? images : [FALLBACK_IMAGE],
        mapUrl: item['Googleマップ口コミURL'] || '',
        review: item['代表口コミ'] || item['代表コメント'] || '',
        snsUrl: item['公式SNSリンク'] || item['公式SNS_URL'] || '',
        siteUrl: item['公式サイト_URL'] || ''
      };
    }).filter(shop => shop.name !== '名称未設定');

    updateCategoryTags();
    renderShops();
  } catch (e) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px 16px; color: #ef4444; font-size: 0.85rem; line-height: 1.6;">
        <strong>データの読み込みに失敗しました</strong><br>
        ${e.message}
      </div>`;
  }
}

function updateCategoryTags() {
  const categories = Array.from(new Set(allShops.map(s => s.category).filter(c => c)));
  const tagContainer = document.querySelector('.filter-tags');
  if (!tagContainer) return;

  let html = `<button class="tag-btn ${currentCategory === 'すべて' ? 'active' : ''}" onclick="filterCategory('すべて')">すべて</button>`;
  categories.forEach(cat => {
    html += `<button class="tag-btn ${currentCategory === cat ? 'active' : ''}" onclick="filterCategory('${cat}')">${cat}</button>`;
  });
  tagContainer.innerHTML = html;
}

function renderShops() {
  const container = document.getElementById('shopList');
  const filtered = allShops.filter(shop => {
    const matchCategory = currentCategory === 'すべて' || shop.category === currentCategory;
    const matchBudget = maxBudget >= 10000 || (shop.budgetMin !== null ? shop.budgetMin <= maxBudget : true);

    const targetText = `${shop.name} ${shop.category} ${shop.menu} ${shop.comment} ${shop.address}`.toLowerCase();
    const matchKeyword = !keyword || targetText.includes(keyword.toLowerCase());

    return matchCategory && matchBudget && matchKeyword;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px 0; color: #94a3b8;">条件に一致するお店が見つかりませんでした</div>';
    return;
  }

  container.innerHTML = filtered.map(shop => {
    const statusClass = getStatusClass(shop.status);

    return `
      <div class="shop-card" onclick="openModal(${shop._index})">
        <img src="${shop.images[0]}" class="shop-img" alt="${shop.name}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE}';">
        <div class="shop-info">
          <div class="shop-header">
            <div class="shop-name">${shop.name}</div>
            <div class="shop-category">${shop.category}</div>
          </div>
          <div>
            <span class="shop-status ${statusClass}">${shop.status}</span>
          </div>
          <div class="shop-details">
            <div>💰 予算: ${formatBudget(shop.budgetMin, shop.budgetMax)}</div>
            <div>📍 ${shop.address || '住所情報なし'}</div>
            <div>🍴 ${shop.menu || 'おすすめ情報なし'}</div>
          </div>
          <div class="tap-hint">タップして詳細・マップを見る ➔</div>
        </div>
      </div>
    `;
  }).join('');
}

function openModal(index) {
  const shop = allShops.find(s => s._index === index);
  if (!shop) return;

  document.getElementById('modalName').textContent = shop.name;
  document.getElementById('modalCategory').textContent = shop.category;

  const gallery = document.getElementById('modalGallery');
  const indicator = document.getElementById('galleryIndicator');

  gallery.innerHTML = shop.images.map((url, i) => `
    <img src="${url}" class="gallery-item" alt="店舗写真 ${i+1}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE}';">
  `).join('');

  indicator.textContent = `1 / ${shop.images.length}`;
  indicator.style.display = shop.images.length > 1 ? 'block' : 'none';

  gallery.onscroll = () => {
    const itemWidth = gallery.offsetWidth;
    const page = Math.round(gallery.scrollLeft / itemWidth) + 1;
    indicator.textContent = `${page} / ${shop.images.length}`;
  };

  const statusEl = document.getElementById('modalStatus');
  statusEl.textContent = shop.status;
  statusEl.className = 'shop-status ' + getStatusClass(shop.status);

  const updateEl = document.getElementById('modalUpdateTime');
  if (shop.updatedAt) {
    updateEl.textContent = `🕒 更新: ${shop.updatedAt}`;
    updateEl.style.display = 'inline-block';
  } else {
    updateEl.style.display = 'none';
  }

  document.getElementById('modalBudget').textContent = formatBudget(shop.budgetMin, shop.budgetMax);
  document.getElementById('modalHours').textContent = shop.hours || '未設定';

  const weeklyBox = document.getElementById('modalWeeklyBox');
  if (shop.weeklyHours) {
    document.getElementById('modalWeeklyHours').textContent = shop.weeklyHours;
    weeklyBox.style.display = 'block';
  } else {
    weeklyBox.style.display = 'none';
  }

  document.getElementById('modalMenu').textContent = shop.menu || '未設定';
  document.getElementById('modalComment').textContent = shop.comment || '店舗紹介文は準備中です。';
  document.getElementById('modalAddress').textContent = shop.address || '住所情報なし';

  const instaBtn = document.getElementById('modalInsta');
  if (shop.snsUrl) {
    instaBtn.href = shop.snsUrl;
    instaBtn.style.display = 'inline-block';
  } else {
    instaBtn.style.display = 'none';
  }

  const siteBtn = document.getElementById('modalSite');
  if (shop.siteUrl) {
    siteBtn.href = shop.siteUrl;
    siteBtn.style.display = 'inline-block';
  } else {
    siteBtn.style.display = 'none';
  }

  const reviewBox = document.getElementById('modalReviewBox');
  if (shop.review) {
    document.getElementById('modalReviewText').textContent = shop.review;
    reviewBox.style.display = 'block';
  } else {
    reviewBox.style.display = 'none';
  }

  const encodedAddress = encodeURIComponent(shop.address || shop.name);
  document.getElementById('modalMapFrame').src = `https://maps.google.co.jp/maps?output=embed&q=${encodedAddress}`;

  document.getElementById('modalTel').href = shop.tel ? `tel:${shop.tel}` : '#';
  document.getElementById('modalReviewBtn').href = shop.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

  if (window.location.hash !== '#modal') {
    history.pushState({ modalOpen: true }, '', '#modal');
  }
  document.getElementById('shopModal').classList.add('active');
}

function closeModal(e) {
  if (window.location.hash === '#modal') {
    history.back();
  } else {
    document.getElementById('shopModal').classList.remove('active');
  }
}

window.addEventListener('popstate', (event) => {
  const modal = document.getElementById('shopModal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
  }
});

function handleSearch() {
  keyword = document.getElementById('searchInput').value.trim();
  renderShops();
}

function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === cat);
  });
  renderShops();
}

function filterBudget(val) {
  maxBudget = parseInt(val);
  document.getElementById('budgetValue').textContent = val >= 10000 ? '指定なし' : `〜¥${Number(val).toLocaleString()}`;
  renderShops();
}

// 初期ロード
loadShops();
updateVisitorCount();

// 30秒ごとの自動再取得
setInterval(() => {
  loadShops();
}, 30000);
