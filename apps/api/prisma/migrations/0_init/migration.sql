-- CreateTable
CREATE TABLE `app_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` VARCHAR(500) NOT NULL,
    `setting_group` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_app_settings_key`(`setting_key`),
    INDEX `fk_app_settings_user`(`updated_by`),
    INDEX `idx_app_settings_group`(`setting_group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` BIGINT UNSIGNED NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_audit_action`(`action`),
    INDEX `idx_audit_date`(`created_at`),
    INDEX `idx_audit_entity`(`entity_type`, `entity_id`),
    INDEX `idx_audit_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `business_name` VARCHAR(150) NOT NULL DEFAULT 'MALA MÍA',
    `logo_url` VARCHAR(500) NULL,
    `phone` VARCHAR(50) NULL,
    `whatsapp` VARCHAR(50) NULL,
    `instagram` VARCHAR(150) NULL,
    `facebook` VARCHAR(150) NULL,
    `address` VARCHAR(500) NULL,
    `receipt_message` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_categories_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `colors` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `normalized_name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_colors_normalized_name`(`normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exchange_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `exchange_id` BIGINT UNSIGNED NOT NULL,
    `movement_direction` VARCHAR(20) NOT NULL,
    `original_sale_item_id` BIGINT UNSIGNED NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `inventory_item_id` BIGINT UNSIGNED NOT NULL,
    `size_id` BIGINT UNSIGNED NOT NULL,
    `color_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,
    `historical_unit_price` DECIMAL(12, 2) NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL,

    INDEX `fk_exchange_items_color`(`color_id`),
    INDEX `fk_exchange_items_original_sale_item`(`original_sale_item_id`),
    INDEX `fk_exchange_items_product`(`product_id`),
    INDEX `fk_exchange_items_size`(`size_id`),
    INDEX `idx_exchange_items_exchange`(`exchange_id`),
    INDEX `idx_exchange_items_inventory`(`inventory_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exchanges` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `original_sale_id` BIGINT UNSIGNED NOT NULL,
    `exchange_number` VARCHAR(50) NOT NULL,
    `exchange_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `difference_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `difference_direction` VARCHAR(20) NOT NULL DEFAULT 'NONE',
    `payment_method_id` BIGINT UNSIGNED NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_exchanges_number`(`exchange_number`),
    INDEX `fk_exchanges_payment_method`(`payment_method_id`),
    INDEX `fk_exchanges_user`(`created_by`),
    INDEX `idx_exchanges_date`(`exchange_date`),
    INDEX `idx_exchanges_sale`(`original_sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_expense_categories_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `expense_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `payment_method_id` BIGINT UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_expenses_payment_method`(`payment_method_id`),
    INDEX `fk_expenses_user`(`created_by`),
    INDEX `idx_expenses_category`(`category_id`),
    INDEX `idx_expenses_date`(`expense_date`),
    INDEX `idx_expenses_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `movement_type` VARCHAR(40) NOT NULL,
    `direction` VARCHAR(10) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_method_id` BIGINT UNSIGNED NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NOT NULL,
    `movement_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_financial_payment_method`(`payment_method_id`),
    INDEX `fk_financial_user`(`created_by`),
    INDEX `idx_financial_date`(`movement_date`),
    INDEX `idx_financial_reference`(`reference_type`, `reference_id`),
    INDEX `idx_financial_type`(`movement_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `size_id` BIGINT UNSIGNED NOT NULL,
    `color_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `average_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `is_available_for_sale` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_inventory_color`(`color_id`),
    INDEX `fk_inventory_size`(`size_id`),
    INDEX `idx_inventory_available`(`is_available_for_sale`),
    INDEX `idx_inventory_product`(`product_id`),
    INDEX `idx_inventory_stock`(`quantity`),
    UNIQUE INDEX `uq_inventory_combination`(`product_id`, `size_id`, `color_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `inventory_item_id` BIGINT UNSIGNED NOT NULL,
    `movement_type` VARCHAR(40) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `quantity_before` INTEGER NOT NULL,
    `quantity_after` INTEGER NOT NULL,
    `unit_cost` DECIMAL(12, 2) NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_inventory_movements_user`(`created_by`),
    INDEX `idx_inventory_movements_date`(`created_at`),
    INDEX `idx_inventory_movements_item`(`inventory_item_id`),
    INDEX `idx_inventory_movements_reference`(`reference_type`, `reference_id`),
    INDEX `idx_inventory_movements_type`(`movement_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `applies_to_sales` BOOLEAN NOT NULL DEFAULT true,
    `applies_to_purchases` BOOLEAN NOT NULL DEFAULT true,
    `applies_to_expenses` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_payment_methods_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_colors` (
    `product_id` BIGINT UNSIGNED NOT NULL,
    `color_id` BIGINT UNSIGNED NOT NULL,

    INDEX `fk_product_colors_color`(`color_id`),
    PRIMARY KEY (`product_id`, `color_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_sizes` (
    `product_id` BIGINT UNSIGNED NOT NULL,
    `size_id` BIGINT UNSIGNED NOT NULL,

    INDEX `fk_product_sizes_size`(`size_id`),
    PRIMARY KEY (`product_id`, `size_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `sale_price` DECIMAL(12, 2) NULL,
    `is_available_for_sale` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_products_code`(`code`),
    INDEX `idx_products_available`(`is_available_for_sale`),
    INDEX `idx_products_category`(`category_id`),
    INDEX `idx_products_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profit_distribution_periods` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `week_start` DATE NOT NULL,
    `week_end` DATE NOT NULL,
    `real_profit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `personal_percentage` DECIMAL(5, 2) NOT NULL,
    `reinvestment_percentage` DECIMAL(5, 2) NOT NULL,
    `reserve_percentage` DECIMAL(5, 2) NOT NULL,
    `personal_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `reinvestment_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `reserve_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_profit_distribution_week`(`week_start`, `week_end`),
    UNIQUE INDEX `uq_profit_distribution_week`(`week_start`, `week_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profit_distribution_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `personal_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
    `reinvestment_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    `reserve_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_profit_distribution_updated_by`(`updated_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_additional_costs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `purchase_id` BIGINT UNSIGNED NOT NULL,
    `cost_type` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_purchase_additional_costs_purchase`(`purchase_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `purchase_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `size_id` BIGINT UNSIGNED NOT NULL,
    `color_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `cost_is_estimated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_purchase_items_color`(`color_id`),
    INDEX `fk_purchase_items_size`(`size_id`),
    INDEX `idx_purchase_items_product`(`product_id`),
    INDEX `idx_purchase_items_purchase`(`purchase_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchases` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `purchase_number` VARCHAR(50) NOT NULL,
    `purchase_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `payment_method_id` BIGINT UNSIGNED NOT NULL,
    `goods_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `additional_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `cost_mode` VARCHAR(20) NOT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_purchases_number`(`purchase_number`),
    INDEX `fk_purchases_payment_method`(`payment_method_id`),
    INDEX `fk_purchases_user`(`created_by`),
    INDEX `idx_purchases_date`(`purchase_date`),
    INDEX `idx_purchases_status`(`status`),
    INDEX `idx_purchases_supplier`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `receipt_number` VARCHAR(50) NOT NULL,
    `generated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_receipts_sale`(`sale_id`),
    UNIQUE INDEX `uq_receipts_number`(`receipt_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `return_id` BIGINT UNSIGNED NOT NULL,
    `sale_item_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,
    `condition_status` VARCHAR(20) NOT NULL,
    `notes` TEXT NULL,

    INDEX `idx_return_items_return`(`return_id`),
    INDEX `idx_return_items_sale_item`(`sale_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `returns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `return_number` VARCHAR(50) NOT NULL,
    `return_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `reason` VARCHAR(255) NOT NULL,
    `refund_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `refund_payment_method_id` BIGINT UNSIGNED NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_returns_number`(`return_number`),
    INDEX `fk_returns_payment_method`(`refund_payment_method_id`),
    INDEX `fk_returns_user`(`created_by`),
    INDEX `idx_returns_date`(`return_date`),
    INDEX `idx_returns_sale`(`sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_roles_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `inventory_item_id` BIGINT UNSIGNED NOT NULL,
    `size_id` BIGINT UNSIGNED NOT NULL,
    `color_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_sale_price` DECIMAL(12, 2) NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_sale_items_color`(`color_id`),
    INDEX `fk_sale_items_size`(`size_id`),
    INDEX `idx_sale_items_inventory`(`inventory_item_id`),
    INDEX `idx_sale_items_product`(`product_id`),
    INDEX `idx_sale_items_sale`(`sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_number` VARCHAR(50) NOT NULL,
    `sale_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `discount_type` VARCHAR(20) NULL,
    `discount_value` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `shipping_customer_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `shipping_actual_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `shipping_paid_by` VARCHAR(20) NULL,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `payment_method_id` BIGINT UNSIGNED NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_sales_number`(`sale_number`),
    INDEX `fk_sales_created_by`(`created_by`),
    INDEX `fk_sales_updated_by`(`updated_by`),
    INDEX `idx_sales_date`(`sale_date`),
    INDEX `idx_sales_payment_method`(`payment_method_id`),
    INDEX `idx_sales_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sizes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `normalized_name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_sizes_normalized_name`(`normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `whatsapp` VARCHAR(50) NULL,
    `contact_person` VARCHAR(150) NULL,
    `address` VARCHAR(500) NULL,
    `social` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_suppliers_active`(`is_active`),
    INDEX `idx_suppliers_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `session_token_hash` VARCHAR(255) NOT NULL,
    `device_name` VARCHAR(150) NULL,
    `user_agent` VARCHAR(500) NULL,
    `last_activity_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expires_at` DATETIME(0) NULL,
    `revoked_at` DATETIME(0) NULL,

    UNIQUE INDEX `uq_user_sessions_token`(`session_token_hash`),
    INDEX `idx_user_sessions_active`(`user_id`, `revoked_at`, `expires_at`),
    INDEX `idx_user_sessions_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_users_username`(`username`),
    INDEX `fk_users_role`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `app_settings` ADD CONSTRAINT `fk_app_settings_user` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchange_items` ADD CONSTRAINT `fk_exchange_items_color` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchange_items` ADD CONSTRAINT `fk_exchange_items_exchange` FOREIGN KEY (`exchange_id`) REFERENCES `exchanges`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchange_items` ADD CONSTRAINT `fk_exchange_items_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchange_items` ADD CONSTRAINT `fk_exchange_items_original_sale_item` FOREIGN KEY (`original_sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchange_items` ADD CONSTRAINT `fk_exchange_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchange_items` ADD CONSTRAINT `fk_exchange_items_size` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchanges` ADD CONSTRAINT `fk_exchanges_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchanges` ADD CONSTRAINT `fk_exchanges_sale` FOREIGN KEY (`original_sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exchanges` ADD CONSTRAINT `fk_exchanges_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `fk_financial_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `fk_financial_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `fk_inventory_color` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `fk_inventory_size` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `fk_inventory_movements_item` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `fk_inventory_movements_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_colors` ADD CONSTRAINT `fk_product_colors_color` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_colors` ADD CONSTRAINT `fk_product_colors_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_sizes` ADD CONSTRAINT `fk_product_sizes_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_sizes` ADD CONSTRAINT `fk_product_sizes_size` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profit_distribution_settings` ADD CONSTRAINT `fk_profit_distribution_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_additional_costs` ADD CONSTRAINT `fk_purchase_additional_costs_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `fk_purchase_items_color` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `fk_purchase_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `fk_purchase_items_size` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `fk_purchases_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `fk_purchases_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipts` ADD CONSTRAINT `fk_receipts_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_items_return` FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_items_sale_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `fk_returns_payment_method` FOREIGN KEY (`refund_payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `fk_returns_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `fk_returns_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `fk_sale_items_color` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `fk_sale_items_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `fk_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `fk_sale_items_size` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `fk_sales_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `fk_sales_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `fk_sales_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

