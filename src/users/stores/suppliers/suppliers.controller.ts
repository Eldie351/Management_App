import { Body, Controller, Post, Get, Delete, Patch, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
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
  async create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  // Tous les fournisseurs des magasins de l'utilisateur connecté.
  @Get()
  async findAll(@Request() req) {
    return this.suppliersService.findAllByUser(req.user.id);
  }

  // Bonus : fournisseurs d'un magasin précis (même logique que /categories/store/:id).
  @Get('store/:id')
  async findByStore(@Param('id', ParseIntPipe) storeId: number) {
    return this.suppliersService.findAllByStore(storeId);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.remove(id);
  }
}
