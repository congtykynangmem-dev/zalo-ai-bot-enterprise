# 🤖 Zalo AI Bot Enterprise (RAG & Mini CRM)

Hệ thống **Zalo AI Bot cấp Doanh Nghiệp** toàn diện: Tích hợp mô hình ngôn ngữ lớn **Google Gemini Pro**, kiến trúc **RAG (Retrieval-Augmented Generation)** với **PostgreSQL + pgvector (768 chiều)**, cơ chế **Human Handoff (chuyển giao nhân viên CSKH)** và hệ thống **Mini CRM** quản lý khách hàng theo thời gian thực (Real-time).

---

## 🌟 Tính Năng Nổi Bật

1. **Zalo Real-time Webhook & Bảo mật MAC:**
   - Thay thế hoàn toàn cơ chế Long Polling cũ bằng Webhook hai chiều `POST /webhook`.
   - Middleware xác thực mã băm (**MAC Validation / HMAC-SHA256**) chống giả mạo request từ bên ngoài.
   - Xử lý đa phương tiện (**Vision OCR**): Đọc hình ảnh, hóa đơn, tài liệu do người dùng gửi qua Zalo.
   - Tích hợp **Rate Limiting** bảo vệ máy chủ và ngăn chặn cạn kiệt AI Token.

2. **Kiến trúc RAG & Kho Tri Thức Nội Bộ (Knowledge Base):**
   - Hỗ trợ tải lên đa định dạng tài liệu: **PDF, Word (.docx), Văn bản (.txt, .md)**.
   - Tự động chia nhỏ văn bản thông minh (**Recursive Chunking with Overlap**).
   - Vector hóa tài liệu với mô hình **Gemini `text-embedding-004` (768 chiều)**.
   - Tìm kiếm tương đồng ngữ nghĩa siêu tốc với **pgvector** và chỉ mục **HNSW (Cosine Distance `<=>`)**.
   - **Grounded Prompting**: Ép AI trả lời bám sát 100% tài liệu nội bộ, từ chối bịa đặt thông tin khi không có trong dữ liệu.
   - **RAG Simulator**: Bộ công cụ kiểm thử truy vấn vector trực tiếp ngay trên Dashboard.

3. **Cơ chế Chuyển Giao Nhân Viên (Human Handoff):**
   - Cờ trạng thái `is_human_mode` kiểm soát quyền trả lời giữa AI và người thật.
   - **Tự động nhận diện ý định:** Khi khách hàng nhắn từ khóa như *"gặp nhân viên"*, *"tư vấn viên"*, *"cần người hỗ trợ"*, hệ thống tự động kích hoạt chế độ nhân viên và thông báo cho khách.
   - **Can thiệp thủ công:** Nhân viên CSKH có thể bấm nút **"Can thiệp"** bất kỳ lúc nào trên màn hình Live Chat để nhắn tin trực tiếp với khách qua Zalo.
   - Nút **"Trả lại cho AI"** giúp tắt cờ can thiệp và kích hoạt lại bot AI tức thì.

4. **Mini CRM & Tự Động Phân Loại (Auto-Tagging):**
   - Tự động Upsert hồ sơ khách hàng ngay khi có tin nhắn đầu tiên.
   - **Session Memory:** Truy xuất 5-10 tin nhắn gần nhất để duy trì mạch ngữ cảnh hội thoại cho Gemini.
   - **Auto-Tagging AI:** Gemini tự động phân loại nhu cầu của khách hàng vào các thẻ (Tags): *Hỏi giá, Tư vấn sản phẩm, Kỹ thuật, Khiếu nại, Khách VIP...*
   - Quản lý ghi chú CRM nội bộ và lịch sử tương tác.

5. **Phân Quyền Quản Trị (RBAC) & Live Chat Real-time:**
   - Xác thực an toàn bằng **JWT** (JSON Web Token).
   - Phân quyền: **Admin** (toàn quyền quản trị tài liệu RAG, nhân viên, cài đặt) và **CSKH** (chuyên viên trực chat và hỗ trợ khách hàng).
   - Giao diện **Single Page Application (SPA)** hiện đại phong cách Glassmorphism Dark Mode.
   - Kết nối **Socket.IO Real-time** cập nhật tức thì tin nhắn, chuông thông báo âm thanh và cảnh báo handoff.

---

## 📁 Cấu Trúc Dự Án (Modular / Clean Architecture)

```
AIBotZalo/
├── src/
│   ├── config/
│   │   ├── db.js                 # Kết nối PostgreSQL Pool & kiểm tra pgvector
│   │   └── env.js                # Quản lý & kiểm tra biến môi trường
│   ├── controllers/
│   │   ├── authController.js     # Đăng nhập, thông tin tài khoản, tạo nhân viên
│   │   ├── webhookController.js  # Nhận Webhook Zalo, xử lý tin nhắn & ảnh
│   │   ├── cskhController.js     # Live Chat, can thiệp & gửi tin nhắn CSKH
│   │   ├── crmController.js      # Quản lý khách hàng, gắn thẻ, thống kê
│   │   └── knowledgeController.js# Tải lên tài liệu, nhúng vector, test RAG
│   ├── middlewares/
│   │   ├── auth.js               # Xác thực JWT & phân quyền vai trò (RBAC)
│   │   ├── rateLimiter.js        # Giới hạn tần suất request (Rate limiting)
│   │   ├── zaloSecurity.js       # Xác thực mã băm chữ ký MAC của Zalo
│   │   └── upload.js             # Cấu hình Multer tải tệp PDF, DOCX, TXT
│   ├── models/
│   │   ├── userModel.js          # Truy vấn bảng users (Mini CRM)
│   │   ├── messageModel.js       # Truy vấn lịch sử tin nhắn & Session Memory
│   │   ├── adminModel.js         # Truy vấn tài khoản quản trị & nhân viên
│   │   └── knowledgeModel.js     # Truy vấn tài liệu & Vector search pgvector
│   ├── routes/
│   │   ├── webhookRoutes.js      # Endpoint /webhook & /send-message
│   │   ├── authRoutes.js         # Endpoint /api/auth/*
│   │   ├── cskhRoutes.js         # Endpoint /api/cskh/*
│   │   ├── crmRoutes.js          # Endpoint /api/crm/*
│   │   └── knowledgeRoutes.js    # Endpoint /api/knowledge/* & /upload-knowledge
│   ├── services/
│   │   ├── zaloService.js        # Gọi Zalo Bot API (gửi tin nhắn, tải media)
│   │   ├── geminiService.js      # Gemini LLM, Vision, Embeddings & Auto-Tagging
│   │   ├── ragService.js         # Trích xuất văn bản, chunking, nhúng vector
│   │   ├── handoffService.js     # Nhận diện ý định & kích hoạt Human Mode
│   │   └── socketService.js      # WebSockets Socket.IO cho Live Chat
│   ├── utils/
│   │   ├── textChunker.js        # Thuật toán cắt nhỏ văn bản kèm Overlap
│   │   └── documentParser.js     # Bộ đọc định dạng PDF, Word DOCX, Text
│   └── app.js                    # Khởi tạo Express app, middleware, routes
├── public/                       # Giao diện Web Dashboard (Real-time SPA)
│   ├── index.html                # Giao diện quản trị đa tab
│   ├── css/
│   │   └── dashboard.css         # Giao diện Glassmorphism Dark Mode
│   └── js/
│       ├── api.js                # API Client có kèm JWT Header
│       ├── socket.js             # Kết nối Socket.IO thời gian thực
│       └── app.js                # Logic điều khiển giao diện Dashboard
├── scripts/
│   ├── schema.sql                 # Khởi tạo bảng, Trigger và Vector Index HNSW
│   └── seed.js                    # Script khởi tạo cơ sở dữ liệu & tài khoản mẫu
├── uploads/                      # Thư mục tạm lưu tệp tải lên
├── .env.example                  # File mẫu cấu hình biến môi trường
├── ecosystem.config.js           # Cấu hình triển khai PM2 cho Production
├── server.js                     # Điểm khởi chạy chính của Server
└── package.json                  # Khai báo dependencies & scripts
```

---

## 🛠️ Yêu Cầu Hệ Thống (Prerequisites)

1. **Node.js**: Phiên bản `>= 20.0.0`
2. **PostgreSQL**: Phiên bản `>= 15.0` đã kích hoạt extension **`pgvector`**
   - *Mẹo nhanh:* Bạn có thể sử dụng Docker để tạo ngay PostgreSQL có sẵn pgvector:
     ```bash
     docker run -d --name zalo-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=zalo_ai_crm pgvector/pgvector:pg16
     ```
   - Hoặc sử dụng các dịch vụ cloud miễn phí có sẵn pgvector như **Supabase**, **Neon.tech**, **Aiven**.
3. **Google Gemini API Key**: Đăng ký miễn phí tại [Google AI Studio](https://aistudio.google.com/).
4. **Zalo Bot Token & App Secret**: Lấy tại cổng phát triển bot [bot.zapps.me](https://bot.zapps.me/docs/create-bot).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Hệ Thống

### Bước 1: Cài đặt Dependencies

Mở terminal trong thư mục dự án và chạy:

```bash
npm install
```

### Bước 2: Cấu hình biến môi trường (.env)

Sao chép file `.env.example` thành file `.env`:

```bash
cp .env.example .env
```

Chỉnh sửa các thông số thực tế trong file `.env`:

```env
# Cấu hình Server
PORT=3000
NODE_ENV=development

# Cấu hình Zalo Bot & Webhook
ZALO_BOT_TOKEN=dien_bot_token_lay_tu_zapps_me
ZALO_APP_SECRET=dien_app_secret_de_xac_thuc_mac

# Cấu hình Google Gemini AI
GEMINI_API_KEY=dien_gemini_api_key_cua_ban
GEMINI_TEXT_MODEL=gemini-1.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004

# Cấu hình PostgreSQL (có extension pgvector)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zalo_ai_crm

# Cấu hình JWT cho Dashboard
JWT_SECRET=thay_doi_chuoi_bi_mat_jwt_ngau_nhien_tai_day
```

### Bước 3: Khởi tạo Cơ sở Dữ liệu & Tài khoản Mẫu

Chạy script migration và seed tài khoản mặc định:

```bash
node scripts/seed.js
```

> **Tài khoản đăng nhập mặc định sau khi seed:**
> - **Quản trị viên (Admin):**
>   - Tên đăng nhập: `admin`
>   - Mật khẩu: `Admin@123456`
> - **Chuyên viên hỗ trợ (CSKH):**
>   - Tên đăng nhập: `cskh`
>   - Mật khẩu: `Cskh@123456`

### Bước 4: Khởi động Server

#### Chế độ Phát triển (Development - Tự động tải lại khi đổi code):
```bash
npm run dev
```

#### Chế độ Sản xuất (Production với PM2):
```bash
# Cài đặt PM2 toàn cục (nếu chưa có)
npm install -g pm2

# Khởi động ứng dụng với file cấu hình ecosystem
pm2 start ecosystem.config.js

# Xem log hoạt động
pm2 logs zalo-ai-bot-enterprise

# Kiểm tra trạng thái
pm2 status
```

Sau khi chạy:
- 🚀 **Server chạy tại:** `http://localhost:3000`
- 📊 **Trang Quản trị Admin Dashboard:** `http://localhost:3000`
- 📡 **Endpoint Nhận Webhook:** `http://localhost:3000/webhook`

---

## 🌐 Hướng Dẫn Cấu Hình Zalo Webhook với Ngrok

Khi chạy ở môi trường local, bạn cần dùng **Ngrok** để tạo một đường hầm HTTPS công khai giúp Zalo gửi tin nhắn về máy của bạn:

1. Chạy lệnh mở tunnel cổng 3000:
   ```bash
   ngrok http 3000
   ```
2. Bạn sẽ nhận được đường dẫn dạng: `https://abcd-123-456.ngrok-free.app`
3. Truy cập vào trang quản trị Bot Zalo: [bot.zapps.me](https://bot.zapps.me) -> Vào mục **Webhook Settings**:
   - Điền URL: `https://abcd-123-456.ngrok-free.app/webhook`
   - Bấm **Lưu / Xác nhận**.
4. Khi khách hàng nhắn tin cho Bot Zalo, Webhook sẽ lập tức nhận dữ liệu, xử lý RAG và phản hồi khách hàng trong thời gian dưới 1 giây.

---

## 📖 Hướng Dẫn Sử Dụng Các Tính Năng Trên Dashboard

### 1. Nạp Tài Liệu vào Kho Tri Thức RAG
1. Đăng nhập vào Dashboard với tài khoản `admin`.
2. Chuyển sang Tab **"Kho Tri Thức RAG"**.
3. Kéo thả tệp tài liệu doanh nghiệp (file PDF chính sách, Word bảng giá, TXT sản phẩm...) vào ô tải lên.
4. Bấm **"Tải Lên & Nhúng Vào pgvector"**:
   - Hệ thống tự động bóc tách nội dung.
   - Cắt thành từng đoạn ngắn (chunk) tối ưu ngữ nghĩa.
   - Gọi Gemini `text-embedding-004` để lấy vector 768 chiều và lưu vào PostgreSQL.
5. Sử dụng ô **"Giả lập RAG Test"** ở bên cạnh để nhập câu hỏi thử nghiệm và kiểm tra trực tiếp tỷ lệ tương đồng ngữ nghĩa.

### 2. Live Chat & Can Thiệp CSKH (Human Handoff)
1. Chuyển sang Tab **"Live Chat"**.
2. Danh sách khách hàng nhắn tin sẽ hiển thị theo thời gian thực bên trái.
3. Khi khách nhắn từ khóa *"gặp nhân viên"*, chuông cảnh báo sẽ vang lên và khách hàng sẽ được gắn cờ `Can thiệp`.
4. CSKH bấm vào hội thoại:
   - Khung chat hiển thị đầy đủ tin nhắn của Khách, Bot AI, và Nhân viên.
   - Bấm nút **"Can thiệp CSKH"** hoặc trực tiếp nhập nội dung vào ô gửi tin nhắn để trả lời khách.
   - Khi đã tư vấn xong, bấm nút **"🤖 Trả lại cho AI"** để bot tiếp tục trả lời tự động.

### 3. Quản lý Khách Hàng (Mini CRM)
1. Chuyển sang Tab **"Khách Hàng (CRM)"**.
2. Tìm kiếm khách hàng theo Tên hoặc Zalo ID.
3. Xem các thẻ phân loại tự động do Gemini gán (ví dụ: *Hỏi giá*, *Kỹ thuật*).
4. Bấm dấu `+` để thêm thẻ tùy chỉnh thủ công.

---

## 📡 Danh Sách API Chính

| Phương thức | Endpoint | Mô tả | Quyền truy cập |
| :--- | :--- | :--- | :--- |
| `GET` | `/webhook` | Xác thực đăng ký Webhook Zalo | Public |
| `POST` | `/webhook` | Nhận tin nhắn & sự kiện Zalo Real-time | Public (Xác thực MAC) |
| `POST` | `/send-message` | API tương thích cũ gửi tin nhắn Zalo | Public / Token |
| `POST` | `/api/auth/login` | Đăng nhập lấy JWT Token | Public |
| `GET` | `/api/auth/me` | Lấy thông tin tài khoản đang đăng nhập | JWT Bearer |
| `POST` | `/api/auth/staff` | Tạo tài khoản nhân viên mới | Admin |
| `GET` | `/api/cskh/conversations` | Lấy danh sách hội thoại Live Chat | CSKH / Admin |
| `GET` | `/api/cskh/conversations/:id/messages` | Lấy lịch sử tin nhắn của khách hàng | CSKH / Admin |
| `POST` | `/api/cskh/send-message` | Nhân viên CSKH gửi tin nhắn đến Zalo | CSKH / Admin |
| `POST` | `/api/cskh/toggle-human-mode` | Bật/tắt chế độ can thiệp của người thật | CSKH / Admin |
| `GET` | `/api/crm/users` | Lấy danh sách khách hàng & lọc thẻ | CSKH / Admin |
| `PUT` | `/api/crm/users/:id/tags` | Cập nhật thẻ CRM cho khách hàng | CSKH / Admin |
| `GET` | `/api/crm/stats` | Lấy số liệu thống kê tổng quan | CSKH / Admin |
| `POST` | `/api/knowledge/upload` | Tải lên tài liệu và nhúng vào pgvector | Admin |
| `GET` | `/api/knowledge/docs` | Xem danh sách tài liệu trong kho | CSKH / Admin |
| `DELETE` | `/api/knowledge/docs/:id` | Xóa tài liệu và các đoạn vector | Admin |
| `POST` | `/api/knowledge/test-search` | Kiểm tra truy vấn tương đồng RAG | CSKH / Admin |

---

## 🛡️ Bản Quyền & Giấy Phép
Dự án được phát triển theo chuẩn kiến trúc Doanh nghiệp, mã nguồn mở phục vụ mục đích học tập và triển khai thực tế.
Mọi đóng góp hoặc thắc mắc vui lòng liên hệ nhóm phát triển. Chúc bạn vận hành hệ thống Zalo AI thành công!
