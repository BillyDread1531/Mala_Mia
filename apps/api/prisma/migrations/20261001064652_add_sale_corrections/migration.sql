-- CreateTable
CREATE TABLE `sale_corrections` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `sale_item_id` BIGINT UNSIGNED NOT NULL,
    `correction_number` VARCHAR(50) NOT NULL,
    `previous_size_id` BIGINT UNSIGNED NOT NULL,
    `previous_color_id` BIGINT UNSIGNED NOT NULL,
    `previous_quantity` INTEGER NOT NULL,
    `previous_unit_price` DECIMAL(12, 2) NOT NULL,
    `new_size_id` BIGINT UNSIGNED NOT NULL,
    `new_color_id` BIGINT UNSIGNED NOT NULL,
    `new_quantity` INTEGER NOT NULL,
    `new_unit_price` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_sale_corrections_number`(`correction_number`),
    INDEX `idx_sale_corrections_sale`(`sale_id`),
    INDEX `idx_sale_corrections_sale_item`(`sale_item_id`),
    INDEX `fk_sale_corrections_prev_size`(`previous_size_id`),
    INDEX `fk_sale_corrections_prev_color`(`previous_color_id`),
    INDEX `fk_sale_corrections_new_size`(`new_size_id`),
    INDEX `fk_sale_corrections_new_color`(`new_color_id`),
    INDEX `fk_sale_corrections_user`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_sale_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_prev_size` FOREIGN KEY (`previous_size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_prev_color` FOREIGN KEY (`previous_color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_new_size` FOREIGN KEY (`new_size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_new_color` FOREIGN KEY (`new_color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_corrections` ADD CONSTRAINT `fk_sale_corrections_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
