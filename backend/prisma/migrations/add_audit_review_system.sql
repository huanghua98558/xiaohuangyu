-- Migration: Add Audit Review System
-- Description: Add blocked accounts tracking and notification system
-- Created: 2026-03-21

-- ========================================
-- 1. Add new fields to claims table
-- ========================================

ALTER TABLE claims 
ADD COLUMN IF NOT EXISTS block_status VARCHAR(20) DEFAULT 'none';

ALTER TABLE claims 
ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT '[]';

-- Create index for block_status
CREATE INDEX IF NOT EXISTS idx_claims_block_status ON claims(block_status);

-- ========================================
-- 2. Add new fields to users table
-- ========================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_blocked_account BOOLEAN DEFAULT false;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS blocked_account_count INTEGER DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_blocked_at TIMESTAMP;

-- ========================================
-- 3. Create blocked_accounts table
-- ========================================

CREATE TABLE IF NOT EXISTS blocked_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    platform VARCHAR(20) NOT NULL,
    platform_nickname VARCHAR(100),
    platform_user_id VARCHAR(100),
    claim_id INTEGER NOT NULL REFERENCES claims(id),
    task_id INTEGER,
    video_url VARCHAR(500),
    comment_content TEXT,
    comment_submitted_at TIMESTAMP,
    block_type VARCHAR(50) DEFAULT 'comment_hidden',
    detection_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'suspected',
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_note TEXT,
    occurrence_count INTEGER DEFAULT 1,
    detected_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for blocked_accounts
CREATE INDEX IF NOT EXISTS idx_blocked_accounts_user ON blocked_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_accounts_platform ON blocked_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_blocked_accounts_status ON blocked_accounts(status);
CREATE INDEX IF NOT EXISTS idx_blocked_accounts_detected_at ON blocked_accounts(detected_at);
CREATE INDEX IF NOT EXISTS idx_blocked_accounts_claim ON blocked_accounts(claim_id);

-- ========================================
-- 4. Create admin_notifications table
-- ========================================

CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    data JSONB,
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for admin_notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

-- ========================================
-- 5. Create user_notifications table
-- ========================================

CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for user_notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);

-- ========================================
-- 6. Insert default data (optional)
-- ========================================

-- No default data needed for these tables

-- ========================================
-- Migration complete
-- ========================================
