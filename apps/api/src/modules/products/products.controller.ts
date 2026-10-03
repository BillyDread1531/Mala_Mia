import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SetActiveDto } from '../catalog/dto/set-active.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AddVariantsDto } from './dto/add-variants.dto';
import { CheckDuplicatesQueryDto } from './dto/check-duplicates-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { GenerateCodeQueryDto } from './dto/generate-code-query.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { RecommendedPriceQueryDto } from './dto/recommended-price-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginatedProducts, ProductsService } from './products.service';
import { ProductView } from './products.mapper';

function parseProductId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Producto no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: QueryProductsDto): Promise<PaginatedProducts> {
    return this.productsService.list(query);
  }

  @Get('check-duplicates')
  checkDuplicates(
    @Query() query: CheckDuplicatesQueryDto,
  ): Promise<ProductView[]> {
    return this.productsService.checkDuplicates(query.q);
  }

  @Get('generate-code')
  generateCode(
    @Query() query: GenerateCodeQueryDto,
  ): Promise<{ code: string }> {
    return this.productsService
      .generateCode(query.categoryId)
      .then((code) => ({ code }));
  }

  @Get('recommended-price')
  recommendedPrice(
    @Query() query: RecommendedPriceQueryDto,
  ): Promise<{ recommendedPrice: string | null }> {
    return this.productsService.previewRecommendedPrice(query.cost);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductView> {
    return this.productsService.findOne(parseProductId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto): Promise<ProductView> {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductView> {
    return this.productsService.update(parseProductId(id), dto);
  }

  @Patch(':id/variants')
  addVariants(
    @Param('id') id: string,
    @Body() dto: AddVariantsDto,
  ): Promise<ProductView> {
    return this.productsService.addVariants(parseProductId(id), dto.variants);
  }

  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductView> {
    return this.productsService.setActive(
      parseProductId(id),
      dto.isActive,
      BigInt(user.id),
    );
  }
}
