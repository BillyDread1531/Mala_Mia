import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditService } from './audit.service';

@UseGuards(SessionAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: QueryAuditDto) {
    return this.auditService.list(query);
  }
}
