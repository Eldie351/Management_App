import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';

const { ADMIN, MANAGER, CASHIER } = UserRole;

@Controller('tickets')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Un CASHIER ne peut pas recharger/ajuster le stock lui-même (réservé à
  // ADMIN/MANAGER) : il passe par un ticket. Un MANAGER peut de la même
  // façon adresser un ticket à l'ADMIN (ou à un autre MANAGER) du magasin.
  @Post()
  @Roles(CASHIER, MANAGER)
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: any) {
    return this.ticketsService.createTicket(dto, user);
  }

  // Compteur pour le tableau de bord (sens différent selon le rôle, voir
  // TicketsService.countOpenTicketsForUser).
  @Get('pending-count')
  @Roles(ADMIN, MANAGER, CASHIER)
  async pendingCount(@CurrentUser() user: any) {
    const count = await this.ticketsService.countOpenTicketsForUser(user);
    return { count };
  }

  // Visible par les 3 rôles : un CASHIER voit aussi les tickets déjà ouverts
  // par ses collègues sur son magasin (évite les doublons de demande).
  @Get('store/:storeId')
  @Roles(ADMIN, MANAGER, CASHIER)
  async findByStore(@Param('storeId', ParseIntPipe) storeId: number, @CurrentUser() user: any) {
    return this.ticketsService.findAllByStore(storeId, user);
  }

  // Vue "Tous les magasins" de la page Tickets.
  @Get('all')
  @Roles(ADMIN, MANAGER, CASHIER)
  async findAllForUser(@CurrentUser() user: any) {
    return this.ticketsService.findAllForUser(user);
  }

  @Patch(':id/approve')
  @Roles(ADMIN, MANAGER)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.approveTicket(id, user, dto);
  }

  @Patch(':id/close')
  @Roles(ADMIN, MANAGER)
  async close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.closeTicket(id, user, dto);
  }
}
