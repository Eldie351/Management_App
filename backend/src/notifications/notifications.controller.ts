import { Controller, Get, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertStoreAccess } from '../common/utils/store-access.util';
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
  async findByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    // BUGFIX : aucune vérification n'existait — n'importe quel ADMIN/MANAGER
    // pouvait consulter les notifications d'un autre commerce.
    assertStoreAccess(user, storeId, "Vous n'avez pas accès aux notifications de ce magasin.");
    return this.notificationsService.findAllByStore(storeId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    // BUGFIX : idem — voir NotificationsService.markAsRead pour la
    // vérification de propriété désormais faite après récupération de la
    // notification (on ne connaît son storeId qu'après l'avoir chargée).
    return this.notificationsService.markAsRead(id, user);
  }
}
