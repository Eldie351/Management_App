import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

const { ADMIN } = UserRole;

// "Audit Logs" : ADMIN uniquement.
@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findMine(@Request() req) {
    return this.auditLogService.findAllByUser(req.user.id);
  }
}
