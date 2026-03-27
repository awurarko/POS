-- SmartPOS Database Schema
-- Run this file once in phpMyAdmin or MySQL Workbench to set up the database

CREATE DATABASE IF NOT EXISTS smartpos;
USE smartpos;

-- ── Users 
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(10)  PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(64)  NOT NULL,
    full_name   VARCHAR(100) NOT NULL,
    role        ENUM('Admin','Manager','Cashier') NOT NULL DEFAULT 'Cashier',
    status      ENUM('Active','Inactive')         NOT NULL DEFAULT 'Active',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--  Products 
CREATE TABLE IF NOT EXISTS products (
    id          VARCHAR(10)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(50)  NOT NULL DEFAULT 'Other',
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock       INT           NOT NULL DEFAULT 0,
    barcode     VARCHAR(50),
    supplier    VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--  Customers 
CREATE TABLE IF NOT EXISTS customers (
    id          VARCHAR(10)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    email       VARCHAR(100),
    address     VARCHAR(200),
    points      INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Sales 
CREATE TABLE IF NOT EXISTS sales (
    id              VARCHAR(10)   PRIMARY KEY,
    cashier         VARCHAR(50)   NOT NULL,
    customer_id     VARCHAR(10),
    customer_name_manual VARCHAR(100),
    subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total           DECIMAL(10,2) NOT NULL,
    payment_method  VARCHAR(30)   NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- ── Sales Items 
CREATE TABLE IF NOT EXISTS sales_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sale_id     VARCHAR(10)   NOT NULL,
    product_id  VARCHAR(10),
    product_name VARCHAR(100) NOT NULL,
    quantity    INT           NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ── Payments 
CREATE TABLE IF NOT EXISTS payments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sale_id     VARCHAR(10)   NOT NULL,
    method      VARCHAR(30)   NOT NULL,
    amount      DECIMAL(10,2) NOT NULL,
    cash_received DECIMAL(10,2),
    change_due  DECIMAL(10,2),
    payer_number VARCHAR(30),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ── Upgrade notes for existing DBs ───────────────────────────
-- ALTER TABLE products ADD COLUMN supplier VARCHAR(100);
-- ALTER TABLE sales ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE sales ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE sales ADD COLUMN customer_name_manual VARCHAR(100);
-- ALTER TABLE payments ADD COLUMN cash_received DECIMAL(10,2);
-- ALTER TABLE payments ADD COLUMN change_due DECIMAL(10,2);
-- ALTER TABLE payments ADD COLUMN payer_number VARCHAR(30);

-- ── Inventory log 
CREATE TABLE IF NOT EXISTS inventory_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  VARCHAR(10) NOT NULL,
    change_qty  INT         NOT NULL,
    reason      VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- No seed data. Create your first admin user from the setup screen.