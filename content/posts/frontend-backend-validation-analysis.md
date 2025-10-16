# 前後端驗證缺失:一個內部系統的技術分析

## 前言

在開發自動化工具的過程中,我研究了某個內部系統的實作方式,發現了一些值得探討的技術問題。本文純粹從技術角度分析這些問題,並整理成學習教材。

## 問題發現:研究系統架構

### 原始需求

我需要開發一個自動化工具來提升工作效率,因此需要理解目標系統的運作方式。透過瀏覽器開發者工具(F12)分析網路請求和 DOM 結構,發現系統的驗證機制存在問題。

### 系統架構分析

**前端實作:**
```html
<!-- HTML 層級的限制 -->
<input type="date" max-date="2025-01-01">
<button id="submitBtn" disabled>已超過時間</button>

<script>
// JavaScript 時間驗證
function validateTime() {
  const now = new Date();
  const deadline = new Date('2025-01-01 10:00:00');
  
  if (now > deadline) {
    document.getElementById('submitBtn').disabled = true;
    alert('已超過訂餐時間');
    return false;
  }
  return true;
}

function submitForm() {
  if (!validateTime()) {
    return;
  }
  // 使用 fetch 送出表單
  fetch('/api/orders', {
    method: 'POST',
    body: formData
  });
}
</script>
```

**後端實作(推測):**
```javascript
// 後端只接收資料,沒有時間驗證
app.post('/api/orders', (req, res) => {
  const orderData = req.body;
  // 直接儲存,沒有檢查時間
  db.orders.insert(orderData);
  res.json({ success: true });
});
```

## 技術問題分析

### 問題 1: 僅依賴前端驗證

**現況:**
- HTML 屬性限制 (`max-date`, `disabled`)
- JavaScript 函式驗證
- 後端無任何時間檢查

**為什麼這是問題:**

前端驗證的本質:
```
前端驗證 = 在使用者瀏覽器執行的程式碼
          = 完全由使用者控制
          = 可以被修改/停用/繞過
```

具體來說:
1. **HTML 屬性可以被修改** - 透過開發者工具直接編輯
2. **JavaScript 可以被停用** - 瀏覽器設定即可關閉
3. **可以直接發送 HTTP 請求** - 繞過整個前端

### 問題 2: 效能設計缺陷

**系統載入行為:**
```javascript
// 一次載入半年資料
fetch('/api/orders?start_date=2024-07-01&end_date=2025-01-01')
  .then(res => res.json())
  .then(data => {
    // data 包含數千筆記錄
    renderTable(data); // 直接渲染整個表格
  });
```

**問題分析:**
- 大量資料傳輸(可能數 MB)
- DOM 操作負擔重(數千個 table rows)
- 首次載入時間: 2 分鐘

### 問題 3: 強制等待設計

**系統行為:**
```javascript
// 提交後強制等待
async function submitForm() {
  const formData = new FormData();
  formData.append('meal_id', selectedMeal);
  
  const response = await fetch('/api/orders', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  // 強制等待 120 秒
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  alert('訂單已完成');
  window.location.reload();
}
```

**問題分析:**
- 使用者體驗差
- 不必要的阻塞
- 資源浪費

## 解決方案

### 完整的驗證機制

**前端(使用者體驗):**
```javascript
function validateTime() {
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(10, 0, 0, 0);
  
  if (now > deadline) {
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('errorMsg').textContent = '已超過訂餐時間(10:00)';
    return false;
  }
  return true;
}

// 即時回饋,不需等後端
submitButton.addEventListener('click', () => {
  if (!validateTime()) {
    return; // 阻止無效請求
  }
  submitOrder();
});
```

**後端(真正的安全防線):**
```javascript
app.post('/api/orders', (req, res) => {
  // 1. 驗證時間
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(10, 0, 0, 0);
  
  if (now > deadline) {
    return res.status(400).json({
      error: 'ORDER_TIME_EXPIRED',
      message: '已超過訂餐時間(10:00)'
    });
  }
  
  // 2. 驗證其他必要欄位
  if (!req.body.meal_id || !req.body.quantity) {
    return res.status(400).json({
      error: 'INVALID_DATA',
      message: '缺少必要欄位'
    });
  }
  
  // 3. 驗證權限
  if (!isAuthorized(req.user)) {
    return res.status(403).json({
      error: 'UNAUTHORIZED',
      message: '無權限執行此操作'
    });
  }
  
  // 4. 通過所有驗證,處理請求
  const order = await db.orders.insert(req.body);
  res.json({ success: true, order });
});
```

### 效能最佳化

**問題:**
```javascript
// 錯誤:一次載入所有資料
const allOrders = await db.orders.find({});
res.json(allOrders);
```

**解決方案 1: 分頁**
```javascript
app.get('/api/orders', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;
  
  const orders = await db.orders
    .find({})
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await db.orders.countDocuments({});
  
  res.json({
    data: orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});
```

**解決方案 2: 時間範圍過濾**
```javascript
app.get('/api/orders', async (req, res) => {
  // 預設只載入最近 7 天
  const startDate = req.query.start_date || 
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const orders = await db.orders.find({
    date: { $gte: startDate }
  });
  
  res.json(orders);
});
```

**解決方案 3: 前端虛擬滾動**
```javascript
// 使用 react-window 或 react-virtualized
import { FixedSizeList } from 'react-window';

function OrderList({ orders }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={orders.length}
      itemSize={50}
    >
      {({ index, style }) => (
        <div style={style}>
          {orders[index].name}
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 非同步處理取代強制等待

**問題:**
```javascript
// 強制等待
await submitOrder();
await sleep(120000); // 等 2 分鐘
```

**解決方案:**
```javascript
// 後端使用佇列
app.post('/api/orders', async (req, res) => {
  // 1. 立即回應
  const orderId = generateId();
  res.json({
    success: true,
    order_id: orderId,
    status: 'processing'
  });
  
  // 2. 背景處理
  jobQueue.add('process-order', {
    orderId,
    ...req.body
  });
});

// 3. 提供查詢端點
app.get('/api/orders/:id/status', async (req, res) => {
  const order = await db.orders.findOne({ id: req.params.id });
  res.json({ status: order.status });
});

// 4. 前端輪詢或 WebSocket
async function submitOrder() {
  const response = await fetch('/api/orders', {...});
  const { order_id } = await response.json();
  
  // 可以關閉視窗,背景輪詢
  pollOrderStatus(order_id);
}
```

## 安全開發原則

### 1. 永遠不信任前端

```
前端驗證 = UX 最佳化
後端驗證 = 安全保證

兩者都要有,但只有後端是可信的
```

### 2. 防禦性程式設計

```javascript
// 假設每個輸入都可能是惡意的
function processOrder(data) {
  // 驗證所有欄位
  assert(data.meal_id, 'meal_id is required');
  assert(typeof data.meal_id === 'number', 'meal_id must be number');
  assert(data.quantity > 0, 'quantity must be positive');
  
  // 檢查權限
  assert(user.hasPermission('order'), 'unauthorized');
  
  // 檢查業務規則
  assert(isWithinOrderTime(), 'order time expired');
  
  // 都通過才處理
  return createOrder(data);
}
```

### 3. 最小權限原則

```javascript
// 不要預設信任
if (!isAuthenticated(req)) {
  return res.status(401).json({ error: 'Not authenticated' });
}

if (!isAuthorized(req.user, 'order:create')) {
  return res.status(403).json({ error: 'Not authorized' });
}

// 只在明確授權後才執行操作
```

### 4. 輸入驗證與清理

```javascript
// 驗證格式
const schema = {
  meal_id: { type: 'number', min: 1 },
  quantity: { type: 'number', min: 1, max: 10 },
  date: { type: 'date', format: 'YYYY-MM-DD' }
};

// 清理輸入
function sanitize(data) {
  return {
    meal_id: parseInt(data.meal_id),
    quantity: Math.min(Math.max(parseInt(data.quantity), 1), 10),
    date: new Date(data.date).toISOString().split('T')[0]
  };
}
```

## 效能最佳化原則

### 1. 按需載入

```
不要: 一次載入所有資料
應該: 只載入當前需要的資料
```

### 2. 漸進式載入

```javascript
// 先載入重要資料
const recentOrders = await loadRecentOrders();
render(recentOrders);

// 背景載入其他資料
loadHistoricalOrders().then(data => {
  appendToCache(data);
});
```

### 3. 快取策略

```javascript
// Service Worker 快取
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// 記憶體快取
const cache = new Map();
function getOrders(params) {
  const key = JSON.stringify(params);
  if (cache.has(key)) {
    return cache.get(key);
  }
  const data = await fetchOrders(params);
  cache.set(key, data);
  return data;
}
```

## 實際應用:開發自動化工具

### 為什麼需要自動化

原系統的問題:
- 載入時間 2 分鐘
- 操作流程繁瑣
- 強制等待 120 秒
- 對打字成本高的使用者不友善

### 自動化工具的技術方案

```kotlin
// Android App 使用 OkHttp 直接呼叫 API
class OrderRepository {
  private val client = OkHttpClient()
  
  suspend fun submitOrder(mealId: Int): Result<Order> {
    val request = Request.Builder()
      .url("https://api.example.com/orders")
      .post("""
        {
          "meal_id": $mealId,
          "quantity": 1
        }
      """.toRequestBody())
      .build()
    
    return try {
      val response = client.newCall(request).execute()
      if (response.isSuccessful) {
        Result.success(parseOrder(response.body))
      } else {
        Result.failure(Exception(response.message))
      }
    } catch (e: Exception) {
      Result.failure(e)
    }
  }
}
```

### 效能對比

**原系統:**
```
登入: 10秒
載入頁面: 120秒
選擇餐點: 5秒
提交等待: 120秒
總計: 255秒 (4分15秒)
```

**自動化工具:**
```
開啟 App: 1秒 (快取資料)
選擇餐點: 2秒
提交: 3秒 (直接 API 呼叫)
背景驗證: 5秒 (非阻塞)
總計: 11秒
```

**效能提升: 23 倍**

## 技術總結

### 關鍵教訓

1. **前後端驗證都不可少**
   - 前端 = 使用者體驗
   - 後端 = 安全防線

2. **效能設計要及早考慮**
   - 分頁/過濾/快取
   - 虛擬滾動
   - 按需載入

3. **使用者體驗很重要**
   - 非同步處理
   - 即時回饋
   - 避免阻塞

4. **防禦性程式設計**
   - 驗證所有輸入
   - 檢查所有權限
   - 不信任任何前端資料

### 開發檢查清單

**安全性:**
- [ ] 後端有完整的輸入驗證
- [ ] 所有業務規則在後端檢查
- [ ] 權限控制明確且嚴格
- [ ] 不依賴前端驗證

**效能:**
- [ ] 資料載入有分頁或過濾
- [ ] 大量資料使用虛擬滾動
- [ ] 適當的快取策略
- [ ] 非同步處理長時間任務

**使用者體驗:**
- [ ] 載入時間小於 3 秒
- [ ] 即時的錯誤回饋
- [ ] 不阻塞使用者操作
- [ ] 清楚的狀態顯示

## 結語

透過分析這個內部系統,我學到了許多寶貴的技術經驗:

- 前後端驗證的重要性
- 效能最佳化的必要性
- 使用者體驗的價值
- 防禦性程式設計的原則

這些教訓成為我開發自動化工具時的指導原則,也幫助我做出更好的技術決策。