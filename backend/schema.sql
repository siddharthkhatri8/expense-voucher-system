
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('employee', 'director', 'accounts')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
    attachment_path TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voucher_signatures (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id),
    signature_data TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    director_id INTEGER NOT NULL REFERENCES users(id),
    decision VARCHAR(20) NOT NULL
        CHECK (decision IN ('approved', 'rejected')),
    rejection_reason TEXT,
    director_signature TEXT NOT NULL,
    decided_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        decision <> 'rejected'
        OR NULLIF(TRIM(rejection_reason), '') IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_vouchers_employee
    ON vouchers(employee_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_status
    ON vouchers(status);

CREATE INDEX IF NOT EXISTS idx_approvals_voucher
    ON approvals(voucher_id);
