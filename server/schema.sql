-- SmartPOS Database Schema
-- Run this file once in phpMyAdmin or MySQL Workbench to set up the database

CREATE DATABASE IF NOT EXISTS smartpos;
USE smartpos;

-- â”€â”€ Users 
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

-- â”€â”€ Sales 
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

-- â”€â”€ Sales Items 
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

-- â”€â”€ Payments 
CREATE TABLE IF NOT EXISTS payments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sale_id     VARCHAR(10)   NOT NULL,
    method      VARCHAR(30)   NOT NULL,
    amount      DECIMAL(10,2) NOT NULL,
    cash_received DECIMAL(10,2),
    change_due  DECIMAL(10,2),
    payer_number VARCHAR(30),
    provider    VARCHAR(30),
    provider_reference VARCHAR(80),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- â”€â”€ Upgrade notes for existing DBs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- ALTER TABLE products ADD COLUMN supplier VARCHAR(100);
-- ALTER TABLE sales ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE sales ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE sales ADD COLUMN customer_name_manual VARCHAR(100);
-- ALTER TABLE payments ADD COLUMN cash_received DECIMAL(10,2);
-- ALTER TABLE payments ADD COLUMN change_due DECIMAL(10,2);
-- ALTER TABLE payments ADD COLUMN payer_number VARCHAR(30);
-- ALTER TABLE payments ADD COLUMN provider VARCHAR(30);
-- ALTER TABLE payments ADD COLUMN provider_reference VARCHAR(80);
-- ALTER TABLE payments ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- â”€â”€ Inventory log 
CREATE TABLE IF NOT EXISTS inventory_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  VARCHAR(10) NOT NULL,
    change_qty  INT         NOT NULL,
    reason      VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- No seed data. Create your first admin user from the setup screen.

-- Sample products seed (safe to rerun because of INSERT IGNORE)
INSERT IGNORE INTO products (id, name, category, price, stock, barcode, supplier) VALUES
('P100000001', 'Whole Wheat Bread', 'Food', 16.50, 34, '2000000001', 'Sunrise Distributors'),
('P100000002', 'White Bread', 'Food', 14.00, 26, '2000000002', 'Sunrise Distributors'),
('P100000003', 'Long Grain Rice 5kg', 'Food', 92.00, 18, '2000000003', 'Keta Foods'),
('P100000004', 'Jasmine Rice 5kg', 'Food', 108.00, 11, '2000000004', 'Keta Foods'),
('P100000005', 'Spaghetti 500g', 'Food', 12.50, 40, '2000000005', 'Prime Grocers'),
('P100000006', 'Tomato Paste 210g', 'Food', 9.00, 52, '2000000006', 'Prime Grocers'),
('P100000007', 'Vegetable Oil 1L', 'Food', 19.50, 29, '2000000007', 'Golden Pantry'),
('P100000008', 'Corn Flakes 500g', 'Food', 26.00, 14, '2000000008', 'Golden Pantry'),
('P100000009', 'Canned Tuna 170g', 'Food', 18.00, 33, '2000000009', 'Ocean Crest'),
('P100000010', 'Instant Noodles Pack', 'Food', 7.00, 75, '2000000010', 'Prime Grocers'),
('P100000011', 'Bottled Water 500ml', 'Beverages', 4.00, 120, '2000000011', 'BluePeak Beverages'),
('P100000012', 'Bottled Water 1.5L', 'Beverages', 7.50, 80, '2000000012', 'BluePeak Beverages'),
('P100000013', 'Orange Juice 1L', 'Beverages', 22.00, 24, '2000000013', 'Fresh Valley Drinks'),
('P100000014', 'Apple Juice 1L', 'Beverages', 22.00, 19, '2000000014', 'Fresh Valley Drinks'),
('P100000015', 'Malt Drink 330ml', 'Beverages', 8.00, 65, '2000000015', 'City Beverage Hub'),
('P100000016', 'Cola Soft Drink 1.5L', 'Beverages', 12.00, 46, '2000000016', 'City Beverage Hub'),
('P100000017', 'Energy Drink 250ml', 'Beverages', 14.00, 31, '2000000017', 'PowerSip Ltd'),
('P100000018', 'Green Tea 20 Bags', 'Beverages', 28.00, 16, '2000000018', 'PowerSip Ltd'),
('P100000019', 'Milk Powder 400g', 'Food', 34.00, 22, '2000000019', 'Dairy Plus'),
('P100000020', 'Chocolate Bar 80g', 'Food', 6.50, 90, '2000000020', 'Sweet Haven'),
('P100000021', 'Dishwashing Liquid 750ml', 'Household', 15.00, 27, '2000000021', 'Sparkle Homecare'),
('P100000022', 'Laundry Detergent 2kg', 'Household', 38.00, 17, '2000000022', 'Sparkle Homecare'),
('P100000023', 'Toilet Tissue 6-Pack', 'Household', 24.00, 37, '2000000023', 'Home Basics Co'),
('P100000024', 'Paper Towels 2-Pack', 'Household', 19.00, 25, '2000000024', 'Home Basics Co'),
('P100000025', 'Multipurpose Cleaner 500ml', 'Household', 13.00, 30, '2000000025', 'NeatNest Supplies'),
('P100000026', 'Hand Soap 500ml', 'Household', 10.50, 44, '2000000026', 'NeatNest Supplies'),
('P100000027', 'LED Bulb 12W', 'Electronics', 18.00, 41, '2000000027', 'Brightline Electricals'),
('P100000028', 'Extension Cable 4-Way', 'Electronics', 46.00, 13, '2000000028', 'Brightline Electricals'),
('P100000029', 'USB-C Charging Cable', 'Electronics', 29.00, 32, '2000000029', 'Device Depot'),
('P100000030', 'Wireless Mouse', 'Electronics', 85.00, 12, '2000000030', 'Device Depot');

