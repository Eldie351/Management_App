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
  async findAll(@Request() req) {
    // BUGFIX (fonctionnel) : ne renvoyait avant que les actions de l'admin
    // lui-même. La spec demande "voir tous les logs" du commerce, donc on
    // inclut aussi les actions de l'équipe créée par cet admin.
    return this.auditLogService.findAllForAdmin(req.user.id);
  }
}
