import { Body, Controller, Post, Get, Delete, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { assertStoreAccess } from '../../../common/utils/store-access.util';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const { ADMIN, MANAGER } = UserRole;

// "Gérer fournisseurs" : ADMIN et MANAGER uniquement.
@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ADMIN, MANAGER)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async create(@Body() dto: CreateSupplierDto, @CurrentUser() user: any) {
    // BUGFIX : aucune vérification d'accès n'existait.
    assertStoreAccess(user, dto.storeId, "Vous n'avez pas accès à ce magasin.");
    return this.suppliersService.create(dto);
  }

  // Tous les fournisseurs des magasins de l'utilisateur connecté.
  @Get()
  async findAll(@CurrentUser() user: any) {
    // BUGFIX : appelait findAllByUser(userId) qui ne filtrait que sur les
    // magasins POSSÉDÉS (`store.userId`) — un MANAGER (qui ne possède
    // jamais de magasin) obtenait donc toujours une liste vide. On passe
    // maintenant l'utilisateur complet pour couvrir aussi les magasins assignés.
    return this.suppliersService.findAllByUser(user);
  }

  // Bonus : fournisseurs d'un magasin précis (même logique que /categories/store/:id).
  @Get('store/:id')
  async findByStore(@Param('id', ParseIntPipe) storeId: number, @CurrentUser() user: any) {
    assertStoreAccess(user, storeId, "Vous n'avez pas accès à ce magasin.");
    return this.suppliersService.findAllByStore(storeId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: any,
  ) {
    return this.suppliersService.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.suppliersService.remove(id, user);
  }
}
