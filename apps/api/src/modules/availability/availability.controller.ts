import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AvailabilityService } from './availability.service';
import { QueryAvailabilityDto } from './dto/query-availability.dto';

function parseId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Producto no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  list(@Query() query: QueryAvailabilityDto) {
    return this.availabilityService.getAvailability(query);
  }

  @Get(':productId')
  detail(@Param('productId') productId: string) {
    return this.availabilityService.getProductDetail(parseId(productId));
  }
}
