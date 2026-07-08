import { Controller, Get, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

const { ADMIN, MANAGER } = UserRole;

// Les alertes de stock concernent la gestion opérationnelle du magasin,
// pas le poste caisse : réservé à ADMIN/MANAGER, comme "Voir mouvements".
@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ADMIN, MANAGER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('store/:storeId')
  async findByStore(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.notificationsService.findAllByStore(storeId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(id);
  }
}
