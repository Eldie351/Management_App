import { Body, Controller, Post, Get, Delete, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { assertStoreAccess } from '../../../common/utils/store-access.util';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const { ADMIN, MANAGER } = UserRole;

// "Gérer catégories" : ADMIN et MANAGER uniquement (CASHIER exclu partout ici).
@Controller('categories')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ADMIN, MANAGER)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Body() dto: CreateCategoryDto, @CurrentUser() user: any) {
    // BUGFIX : aucune vérification d'accès n'existait — n'importe quel
    // ADMIN/MANAGER pouvait créer une catégorie dans le magasin d'un autre
    // commerce simplement en connaissant son storeId.
    assertStoreAccess(user, dto.storeId, "Vous n'avez pas accès à ce magasin.");
    return this.categoriesService.create(dto);
  }

  @Get('store/:id')
  async findByStore(@Param('id', ParseIntPipe) storeId: number, @CurrentUser() user: any) {
    assertStoreAccess(user, storeId, "Vous n'avez pas accès à ce magasin.");
    return this.categoriesService.findAllByStore(storeId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: any,
  ) {
    // BUGFIX : idem — la vérification se fait maintenant dans le service,
    // qui connaît le storeId réel de la catégorie ciblée.
    return this.categoriesService.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.categoriesService.remove(id, user);
  }
}
