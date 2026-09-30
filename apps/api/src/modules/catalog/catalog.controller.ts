import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CatalogService } from './catalog.service';

@UseGuards(SessionAuthGuard)
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalogService.listCategories();
  }

  @Get('sizes')
  sizes() {
    return this.catalogService.listSizes();
  }

  @Get('colors')
  colors() {
    return this.catalogService.listColors();
  }
}
