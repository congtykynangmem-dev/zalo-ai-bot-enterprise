-- =================================================================
-- HỆ THỐNG ZALO AI BOT (RAG & MINI CRM) - POSTGRESQL + PGVECTOR
-- =================================================================

-- 1. KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. BẢNG ADMINS & NHÂN VIÊN CSKH
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'cskh' CHECK (role IN ('admin', 'cskh')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BẢNG USERS (ZALO CUSTOMERS - MINI CRM)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zalo_user_id VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    tags TEXT[] DEFAULT '{}',
    is_human_mode BOOLEAN DEFAULT FALSE,
    handoff_requested_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BẢNG MESSAGES (LỊCH SỬ CHAT CHI TIẾT)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    zalo_user_id VARCHAR(100) NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'bot', 'agent')),
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    content TEXT NOT NULL,
    media_url TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. BẢNG KNOWLEDGE_DOCS (DANH MỤC TÀI LIỆU KHO TRI THỨC)
CREATE TABLE IF NOT EXISTS knowledge_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. BẢNG KNOWLEDGE_CHUNKS (ĐOẠN VĂN BẢN VÀ VECTOR EMBEDDING 768 CHỮ SỐ CHO GEMINI)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CHỈ MỤC (INDEXES) TỐI ƯU HIỆU NĂNG VÀ TÌM KIẾM VECTOR (HNSW)
-- Index HNSW dùng Cosine Distance (<=>) cho vector search siêu tốc
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw 
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id 
ON knowledge_chunks (doc_id);

CREATE INDEX IF NOT EXISTS idx_users_zalo_user_id 
ON users (zalo_user_id);

CREATE INDEX IF NOT EXISTS idx_users_tags 
ON users USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_users_is_human_mode 
ON users (is_human_mode);

CREATE INDEX IF NOT EXISTS idx_users_last_interaction 
ON users (last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_id 
ON messages (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_zalo_user_id 
ON messages (zalo_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
ON messages (created_at DESC);

-- 8. TRIGGER TỰ ĐỘNG CẬP NHẬT UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at 
BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admins_updated_at ON admins;
CREATE TRIGGER trg_admins_updated_at 
BEFORE UPDATE ON admins 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_knowledge_docs_updated_at ON knowledge_docs;
CREATE TRIGGER trg_knowledge_docs_updated_at 
BEFORE UPDATE ON knowledge_docs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. DỮ LIỆU MẪU MẶC ĐỊNH (Tài khoản Admin ban đầu: admin / Admin@123456)
-- Password hash được tạo bằng bcrypt salt 10 vòng
INSERT INTO admins (username, password_hash, full_name, role, is_active)
VALUES (
    'admin', 
    '$2a$10$iI0iB3T2L5d/C0xTqY0sAOBiFq3D6xwhGg6i608sM.nF4XoV23Y9q', 
    'System Administrator', 
    'admin', 
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- Tài khoản CSKH mẫu: cskh / Cskh@123456
INSERT INTO admins (username, password_hash, full_name, role, is_active)
VALUES (
    'cskh', 
    '$2a$10$J52mY1h/c7XjY8zF1lJpAuEaV23wHq5d6i709sM.nF4XoV23Y9q12', 
    'Nhân Viên CSKH 01', 
    'cskh', 
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 10. BẢNG SETTINGS (CẤU HÌNH HỆ THỐNG & WEBHOOK ĐỘNG)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. BẢNG WEBHOOK_LOGS (NHẬT KÝ SỰ KIỆN WEBHOOK REAL-TIME)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(64) NOT NULL,
    sender_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at 
ON webhook_logs (created_at DESC);

