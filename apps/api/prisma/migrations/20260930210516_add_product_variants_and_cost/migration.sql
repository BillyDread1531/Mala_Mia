-- AlterTable
ALTER TABLE `products` ADD COLUMN `cost` DECIMAL(12, 2) NULL;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `size_id` BIGINT UNSIGNED NOT NULL,
    `color_id` BIGINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_product_variants_size`(`size_id`),
    INDEX `fk_product_variants_color`(`color_id`),
    UNIQUE INDEX `uq_product_variants_combination`(`product_id`, `size_id`, `color_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `fk_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `fk_product_variants_size` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `fk_product_variants_color` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
